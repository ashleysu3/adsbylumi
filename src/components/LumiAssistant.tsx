import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ArrowRight, MessageCircle, Send, Loader2, Sparkle, History, CheckCircle, XCircle, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export interface LumiHistoryItem {
  id: string;
  recommendation: LumiRecommendation;
  timestamp: Date;
  actionTaken: boolean;
  dismissed: boolean;
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
  'add-creative': [
    { label: "Upload my creative", message: "I have new creative ready. Walk me through the upload process." },
    { label: "Brainstorm angles", message: "Help me come up with fresh creative angles for my campaign." },
    { label: "What performs best?", message: "What types of creative are performing best right now?" },
    { label: "Refresh strategy", message: "How do I know when my creative needs refreshing?" },
  ],
};

// Helper to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface LumiAssistantUIProps {
  recommendation: LumiRecommendation | null;
  onDismissForSession?: () => void;
  className?: string;
  history?: LumiHistoryItem[];
  unreadCount?: number;
  onMarkHistoryRead?: () => void;
  onMarkActionTaken?: (recId: string) => void;
}

function LumiAssistantUI({ 
  recommendation, 
  onDismissForSession, 
  className,
  history = [],
  unreadCount = 0,
  onMarkHistoryRead,
  onMarkActionTaken,
}: LumiAssistantUIProps) {
  const location = useLocation();
  const { messages, addMessage, setBrandId } = useLumi();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [currentRecommendationId, setCurrentRecommendationId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
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
          {/* Recommendation Popup - Small card style */}
          {isExpanded && !isDismissed && recommendation && !chatOpen ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="mb-2"
            >
              <Card className="w-72 shadow-lg border-lumi-orange-1/20 bg-card/95 backdrop-blur-sm overflow-hidden">
                {/* Accent bar */}
                <div className="h-1 bg-gradient-lumi" />
                
                {/* Header */}
                <div className="flex items-start justify-between p-3 pb-2">
                  <div className="flex items-center gap-2">
                    <LumiCharacter size="xs" state="idle" glow />
                    <span className="text-xs font-semibold text-gradient-lumi">
                      {recommendation.title}
                    </span>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted/50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {recommendation.message}
                  </p>
                  
                  {recommendation.actionLabel && recommendation.onAction && (
                    <Button
                      onClick={handleAction}
                      variant="lumi"
                      size="sm"
                      className="w-full h-7 text-xs group"
                    >
                      {recommendation.actionLabel}
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </Button>
                  )}

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <button
                      onClick={handleOpenChat}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                      Chat with Lumi
                    </button>
                    
                    {onDismissForSession && (
                      <button
                        onClick={onDismissForSession}
                        className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      >
                        Pause tips
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : null}

          {/* Chat Popup - Branded chat widget */}
          {chatOpen ? (
            <motion.div
              key="chat-popup"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={cn(
                "flex flex-col rounded-2xl shadow-2xl overflow-hidden",
                "bg-gradient-to-b from-card to-card/95 backdrop-blur-xl",
                "border border-lumi-orange-1/10",
                isMaximized ? "w-96 h-[520px]" : "w-80 h-[420px]"
              )}
              style={{
                boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.15), 0 0 40px -10px rgba(236, 72, 153, 0.1)'
              }}
            >
              {/* Branded Chat Header with Gradient */}
              <div className="relative overflow-hidden">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-lumi opacity-95" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-lumi-orange-1/20 via-transparent to-lumi-purple-1/20"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                
                {/* Sparkle decorations */}
                <motion.div
                  className="absolute top-2 right-8 w-1.5 h-1.5 bg-white rounded-full"
                  animate={{
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.2, 0.8],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="absolute top-4 right-16 w-1 h-1 bg-white/80 rounded-full"
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [1, 1.3, 1],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                />
                <motion.div
                  className="absolute bottom-3 right-24 w-1 h-1 bg-white/60 rounded-full"
                  animate={{
                    opacity: [0.4, 0.9, 0.4],
                    scale: [0.9, 1.1, 0.9],
                  }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 1 }}
                />
                
                {/* Header content */}
                <div className="relative flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <LumiCharacter size="sm" state={isLoading ? "thinking" : "idle"} />
                      {/* Online indicator */}
                      <motion.div
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white drop-shadow-sm">Lumi</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-white/80">Your Ad Assistant</span>
                        <Sparkle className="h-2.5 w-2.5 text-white/60 animate-sparkle-pulse" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      {isMaximized ? <Minimize2 className="h-4 w-4 text-white" /> : <Maximize2 className="h-4 w-4 text-white" />}
                    </button>
                    <button
                      onClick={() => setChatOpen(false)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => {
                setActiveTab(v as "chat" | "history");
                if (v === "history" && onMarkHistoryRead) {
                  onMarkHistoryRead();
                }
              }} className="flex flex-col flex-1 overflow-hidden">
                <TabsList className="mx-2 mt-2 h-8 grid grid-cols-2 bg-muted/50">
                  <TabsTrigger value="chat" className="text-xs gap-1 h-7">
                    <MessageCircle className="h-3 w-3" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs gap-1 h-7 relative">
                    <History className="h-3 w-3" />
                    Insights
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 bg-lumi-orange-1 rounded-full flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="flex-1 flex flex-col mt-0 overflow-hidden data-[state=inactive]:hidden">
                  <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                    {messages.length === 0 ? (
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <LumiCharacter size="md" state="idle" glow className="mx-auto mb-2" />
                          <h3 className="font-semibold text-sm mb-1">Hey there! 👋</h3>
                          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            I'm Lumi — here to make Meta Ads simple.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                            <Sparkle className="h-3 w-3 animate-sparkle-pulse" />
                            <span>Quick questions</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {starters.slice(0, 4).map((starter, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                className="h-auto py-2 px-2.5 text-left justify-start whitespace-normal text-[11px]"
                                onClick={() => handleStarterClick(starter.message)}
                              >
                                {starter.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message, idx) => (
                          <div
                            key={idx}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {message.role === 'assistant' && (
                              <LumiCharacter size="xs" state="idle" className="mr-1.5 flex-shrink-0 mt-0.5" />
                            )}
                            <div
                              className={cn(
                                "max-w-[85%] rounded-xl px-3 py-2",
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              )}
                            >
                              <p className="text-xs whitespace-pre-wrap">{message.content}</p>
                            </div>
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex justify-start">
                            <LumiCharacter size="xs" state="thinking" className="mr-1.5" />
                            <div className="bg-muted rounded-xl px-3 py-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="border-t p-2">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage(input);
                      }}
                      className="flex gap-1.5"
                    >
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Lumi..."
                        className="flex-1 h-8 text-xs"
                        disabled={isLoading}
                      />
                      <Button type="submit" size="sm" className="h-8 w-8 p-0" disabled={isLoading || !input.trim()}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 mt-0 overflow-hidden data-[state=inactive]:hidden">
                  <ScrollArea className="h-full p-3">
                    {history.length === 0 ? (
                      <div className="text-center py-8">
                        <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <h3 className="font-semibold text-sm text-muted-foreground mb-1">No insights yet</h3>
                        <p className="text-xs text-muted-foreground/70">
                          Lumi's recommendations will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {history.map((item) => (
                          <Card 
                            key={item.id} 
                            className={cn(
                              "p-2.5 transition-all",
                              item.actionTaken && "border-green-500/30 bg-green-500/5",
                              item.dismissed && !item.actionTaken && "opacity-60"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <div className={cn(
                                "p-1.5 rounded-full shrink-0",
                                item.actionTaken ? "bg-green-500/10" : item.dismissed ? "bg-muted" : "bg-gradient-lumi/10"
                              )}>
                                {item.actionTaken ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : item.dismissed ? (
                                  <XCircle className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <Sparkles className="h-3 w-3 text-lumi-orange-1" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <h4 className="font-medium text-xs truncate">{item.recommendation.title}</h4>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {formatTimeAgo(item.timestamp)}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-2">
                                  {item.recommendation.message}
                                </p>
                                {item.recommendation.actionLabel && item.recommendation.onAction && !item.actionTaken && !item.dismissed && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="mt-1.5 h-6 text-[10px] px-2"
                                    onClick={() => {
                                      item.recommendation.onAction?.();
                                      onMarkActionTaken?.(item.recommendation.id);
                                    }}
                                  >
                                    {item.recommendation.actionLabel}
                                  </Button>
                                )}
                                {item.actionTaken && (
                                  <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-green-600">
                                    <CheckCircle className="h-2.5 w-2.5" /> Done
                                  </span>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </motion.div>
          ) : (
            /* Floating Button */
            <motion.button
              key={`collapsed-${recommendation?.id || 'none'}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: [0.8, 1.15, 0.95, 1.05, 1],
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                opacity: { duration: 0.2 },
                scale: { duration: 0.5, ease: "easeOut" }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleButtonClick}
              className={cn(
                "relative w-12 h-12 rounded-full",
                "bg-gradient-lumi shadow-lg",
                "flex items-center justify-center",
                "transition-shadow duration-300",
                "hover:shadow-[0_0_20px_rgba(234,88,12,0.3)]"
              )}
            >
              <Sparkles className="h-5 w-5 text-white" />
              
              {/* Notification badge */}
              {(unreadCount > 0 || (recommendation && isDismissed)) && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-lumi-orange-1 rounded-full border-2 border-background flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white">
                    {unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : "!"}
                  </span>
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

// Context for managing recommendations across the app
interface LumiAssistantContextType {
  recommendation: LumiRecommendation | null;
  setRecommendation: (rec: LumiRecommendation | null) => void;
  clearRecommendation: () => void;
  dismissForSession: () => void;
  isPausedForSession: boolean;
  history: LumiHistoryItem[];
  unreadCount: number;
  markHistoryRead: () => void;
}

const LumiAssistantContext = createContext<LumiAssistantContextType | undefined>(undefined);

export function LumiAssistantProvider({ children }: { children: ReactNode }) {
  const [recommendation, setRecommendationState] = useState<LumiRecommendation | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isPausedForSession, setIsPausedForSession] = useState(false);
  const [history, setHistory] = useState<LumiHistoryItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const setRecommendation = (rec: LumiRecommendation | null) => {
    // Don't show if paused or already dismissed this session
    if (isPausedForSession) return;
    if (rec && dismissedIds.has(rec.id)) return;
    
    // Add to history if new recommendation
    if (rec && (!recommendation || recommendation.id !== rec.id)) {
      setHistory(prev => {
        // Avoid duplicates
        if (prev.some(h => h.recommendation.id === rec.id)) return prev;
        return [{
          id: `${rec.id}-${Date.now()}`,
          recommendation: rec,
          timestamp: new Date(),
          actionTaken: false,
          dismissed: false,
        }, ...prev].slice(0, 50); // Keep last 50
      });
      setUnreadCount(prev => prev + 1);
    }
    
    setRecommendationState(rec);
  };

  const clearRecommendation = () => {
    if (recommendation) {
      setDismissedIds(prev => new Set(prev).add(recommendation.id));
      // Mark as dismissed in history
      setHistory(prev => prev.map(h => 
        h.recommendation.id === recommendation.id 
          ? { ...h, dismissed: true } 
          : h
      ));
    }
    setRecommendationState(null);
  };

  const dismissForSession = () => {
    setIsPausedForSession(true);
    setRecommendationState(null);
  };

  const markHistoryRead = () => {
    setUnreadCount(0);
  };

  // Function to mark action taken
  const markActionTaken = (recId: string) => {
    setHistory(prev => prev.map(h => 
      h.recommendation.id === recId 
        ? { ...h, actionTaken: true } 
        : h
    ));
  };

  return (
    <LumiAssistantContext.Provider value={{ 
      recommendation, 
      setRecommendation, 
      clearRecommendation, 
      dismissForSession,
      isPausedForSession,
      history,
      unreadCount,
      markHistoryRead,
    }}>
      {children}
      <LumiAssistantUI 
        recommendation={recommendation} 
        onDismissForSession={dismissForSession}
        history={history}
        unreadCount={unreadCount}
        onMarkHistoryRead={markHistoryRead}
        onMarkActionTaken={markActionTaken}
      />
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
