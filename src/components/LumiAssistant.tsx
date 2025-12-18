import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight, MessageCircle, Send, Loader2, Sparkle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { LumiCharacter } from "./LumiCharacter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLumi } from "@/contexts/LumiContext";
import { useLocation } from "react-router-dom";

export interface LumiRecommendation {
  id: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const contextStarters: Record<string, { label: string; message: string }[]> = {
  creative: [
    { label: "Improve my hooks", message: "Help me make my hooks more attention-grabbing and scroll-stopping." },
    { label: "Strengthen copy", message: "Review my primary copy and suggest ways to make it more persuasive." },
    { label: "More variety", message: "I need more variety in my creative concepts. What angles am I missing?" },
    { label: "Script feedback", message: "Can you review my scripts and suggest improvements for better engagement?" },
  ],
  planning: [
    { label: "Refine strategy", message: "Help me refine my campaign strategy based on my offer and audience." },
    { label: "Budget advice", message: "What budget would you recommend for my campaign goals?" },
    { label: "Audience insights", message: "Tell me more about my target audience's psychology and pain points." },
    { label: "KPI guidance", message: "What KPIs should I focus on for this type of campaign?" },
  ],
  data: [
    { label: "Analyze performance", message: "Help me understand what's working and what's not in my campaign data." },
    { label: "Optimization tips", message: "What optimizations would you suggest based on my current metrics?" },
    { label: "Creative fatigue", message: "How do I know if my creative is experiencing fatigue?" },
    { label: "Scaling strategy", message: "My campaign is performing well. How should I scale it?" },
  ],
  campaign: [
    { label: "Review settings", message: "Can you review my campaign settings before I publish?" },
    { label: "Audience selection", message: "Help me decide on the best audience targeting for this campaign." },
    { label: "Budget allocation", message: "How should I allocate my budget between ad sets?" },
    { label: "Missing anything?", message: "Am I missing anything important before launching this campaign?" },
  ],
  dashboard: [
    { label: "What's next?", message: "What should I focus on next to grow my ad results?" },
    { label: "Campaign ideas", message: "Suggest some campaign ideas based on my brand and offers." },
    { label: "Best practices", message: "What are the top Meta Ads best practices I should follow?" },
    { label: "Creative tips", message: "Give me some quick tips to improve my ad creative." },
  ],
  settings: [
    { label: "Account setup", message: "What do I need to set up to get started with Meta Ads?" },
    { label: "Billing questions", message: "Help me understand the billing and subscription options." },
    { label: "Best practices", message: "What are some best practices for managing my ad account?" },
    { label: "Getting started", message: "I'm new here. Where should I start?" },
  ],
  campaigns: [
    { label: "Campaign review", message: "Help me review my active campaigns and see what's working." },
    { label: "Create new campaign", message: "I want to create a new campaign. Where do I start?" },
    { label: "Archive advice", message: "How do I know when to archive or pause a campaign?" },
    { label: "Campaign strategy", message: "How should I organize my campaigns for best results?" },
  ],
  production: [
    { label: "Recording tips", message: "Give me tips for recording my ad videos at home." },
    { label: "Equipment advice", message: "What basic equipment do I need for good video ads?" },
    { label: "Editing help", message: "How should I edit my videos for maximum engagement?" },
    { label: "B-roll ideas", message: "What kind of b-roll footage should I capture?" },
  ],
};

function LumiAssistantUI({ recommendation, className }: { recommendation: LumiRecommendation | null; className?: string }) {
  const location = useLocation();
  const { messages, addMessage, setBrandId } = useLumi();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [currentRecommendationId, setCurrentRecommendationId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine context from route
  const getContextFromRoute = (): string => {
    if (location.pathname.includes('/creative')) return 'creative';
    if (location.pathname.includes('/planning')) return 'planning';
    if (location.pathname.includes('/data')) return 'data';
    if (location.pathname.includes('/production')) return 'production';
    if (location.pathname.includes('/campaigns')) return 'campaigns';
    if (location.pathname.includes('/settings')) return 'settings';
    if (location.pathname.includes('/workspace')) return 'campaign';
    return 'dashboard';
  };

  const context = getContextFromRoute();
  const starters = contextStarters[context] || contextStarters.dashboard;

  // Reset dismissed state when recommendation changes
  useEffect(() => {
    if (recommendation && recommendation.id !== currentRecommendationId) {
      setIsDismissed(false);
      setIsExpanded(true);
      setCurrentRecommendationId(recommendation.id);
      
      // Auto-collapse after 8 seconds
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [recommendation, currentRecommendationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleDismiss = () => {
    setIsExpanded(false);
    setIsDismissed(true);
  };

  const handleAction = () => {
    recommendation?.onAction?.();
    setIsExpanded(false);
    setIsDismissed(true);
  };

  const handleButtonClick = () => {
    if (recommendation && !isDismissed) {
      setIsExpanded(true);
    } else {
      setChatOpen(true);
    }
  };

  const handleOpenChat = () => {
    setIsExpanded(false);
    setChatOpen(true);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    addMessage(userMessage);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('lumi-chat', {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context: { context },
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || "I'm sorry, I couldn't process that. Please try again."
      };
      addMessage(assistantMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStarterClick = (message: string) => {
    sendMessage(message);
  };

  // Don't render on onboarding or auth pages
  if (location.pathname === '/onboarding' || location.pathname === '/auth') {
    return null;
  }

  return (
    <>
      <div className={cn("fixed bottom-6 right-6 z-50", className)}>
        <AnimatePresence mode="wait">
          {isExpanded && !isDismissed && recommendation ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <Card variant="gradient" className="w-80 shadow-glow overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <LumiCharacter size="sm" state="idle" glow />
                    </div>
                    <span className="text-sm font-semibold text-gradient-lumi">
                      {recommendation.title}
                    </span>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {recommendation.message}
                  </p>
                  
                  {recommendation.actionLabel && recommendation.onAction && (
                    <Button
                      onClick={handleAction}
                      variant="lumi"
                      size="sm"
                      className="w-full group"
                    >
                      {recommendation.actionLabel}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  )}

                  {/* Chat link */}
                  <button
                    onClick={handleOpenChat}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center pt-2 border-t border-border/50"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Have a question? Chat with Lumi
                  </button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.button
              key="collapsed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleButtonClick}
              className={cn(
                "relative w-14 h-14 rounded-full",
                "bg-gradient-lumi shadow-glow",
                "flex items-center justify-center",
                "transition-shadow duration-300",
                "hover:shadow-[0_0_30px_rgba(234,88,12,0.4)]"
              )}
            >
              {/* Subtle pulse animation ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-lumi"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              <Sparkles className="h-6 w-6 text-white animate-sparkle" />
              
              {/* Notification dot when collapsed with recommendation */}
              {recommendation && isDismissed && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-lumi-orange-1 rounded-full border-2 border-background animate-pulse" />
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Drawer */}
      <Drawer open={chatOpen} onOpenChange={setChatOpen}>
        <DrawerContent className="h-[85vh] max-h-[85vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LumiCharacter size="md" state={isLoading ? "thinking" : "idle"} glow />
                <div>
                  <DrawerTitle className="text-lg font-display">Lumi</DrawerTitle>
                  <p className="text-xs text-muted-foreground">Meta Ads, Simplified.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="flex flex-col h-[calc(85vh-120px)]">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <LumiCharacter size="lg" state="idle" glow className="mx-auto mb-4" />
                    <h3 className="font-display font-semibold mb-2">Hey there! 👋</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      I'm Lumi — here to make Meta Ads simple. Ask me anything about strategy, creative, or performance.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                      <Sparkle className="h-4 w-4 animate-sparkle-pulse" />
                      <span>Suggested questions</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {starters.map((starter, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          className="h-auto py-3 px-4 text-left justify-start whitespace-normal"
                          onClick={() => handleStarterClick(starter.message)}
                        >
                          <span className="text-sm">{starter.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, idx) => (
                    <div
                      key={idx}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'assistant' && (
                        <LumiCharacter size="sm" state="idle" className="mr-2 flex-shrink-0 mt-1" />
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <LumiCharacter size="sm" state="thinking" className="mr-2" />
                      <div className="bg-muted rounded-2xl px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="border-t p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Lumi anything..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// Context for managing recommendations across the app
interface LumiAssistantContextType {
  recommendation: LumiRecommendation | null;
  setRecommendation: (rec: LumiRecommendation | null) => void;
  clearRecommendation: () => void;
}

const LumiAssistantContext = createContext<LumiAssistantContextType | undefined>(undefined);

export function LumiAssistantProvider({ children }: { children: ReactNode }) {
  const [recommendation, setRecommendationState] = useState<LumiRecommendation | null>(null);

  const setRecommendation = (rec: LumiRecommendation | null) => {
    setRecommendationState(rec);
  };

  const clearRecommendation = () => {
    setRecommendationState(null);
  };

  return (
    <LumiAssistantContext.Provider value={{ recommendation, setRecommendation, clearRecommendation }}>
      {children}
      <LumiAssistantUI recommendation={recommendation} />
    </LumiAssistantContext.Provider>
  );
}

export function useLumiAssistant() {
  const context = useContext(LumiAssistantContext);
  if (context === undefined) {
    throw new Error("useLumiAssistant must be used within a LumiAssistantProvider");
  }
  return context;
}

// Re-export for backward compatibility
export { useLumiAssistant as useLumiRecommend };
