import { useState, useRef, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Send, Loader2, X, Sparkle, Copy, Check, Bug, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SparkleIcon } from "./SparkleIcon";
import { useLumi, Message, NavigationAction } from "@/contexts/LumiContext";
import { BugReportModal } from "./BugReportModal";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ConversationInsight {
  timestamp: string;
  messages: { role: string; content: string }[];
  summary?: string;
}

interface LumiChatProps {
  context: 'creative' | 'planning' | 'data' | 'campaign' | 'dashboard' | 'settings' | 'campaigns' | 'production' | 'add-creative' | 'angle-feedback';
  workspace?: any;
  brand?: any;
  trigger?: ReactNode;
  autoOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  customStarters?: { label: string; message: string }[];
  initialMessage?: string;
  generatedAngles?: any[];
  onSaveInsights?: (insights: ConversationInsight) => void;
}

// Navigation-focused context starters
const contextStarters: Record<string, { label: string; message: string }[]> = {
  start: [
    { label: "Get started", message: "I'm new here. Where should I start?" },
    { label: "Create an ad", message: "How do I create my first ad?" },
    { label: "What can I do?", message: "What can this app help me with?" },
    { label: "Need help", message: "I need help finding something." },
  ],
  dashboard: [
    { label: "Create an ad", message: "How do I create a new ad?" },
    { label: "Add my offer", message: "Where do I add my product or offer?" },
    { label: "Connect Meta", message: "How do I connect my Meta account?" },
    { label: "What's next?", message: "What should I do next?" },
  ],
  campaigns: [
    { label: "New campaign", message: "How do I create a new campaign?" },
    { label: "Continue work", message: "How do I continue a campaign I started?" },
    { label: "Archive", message: "How do I archive old campaigns?" },
    { label: "Need help", message: "I need help understanding this page." },
  ],
  creative: [
    { label: "Get started", message: "How do I get started here?" },
    { label: "Generate angles", message: "How do I create creative angles?" },
    { label: "Write copy", message: "Where do I write my ad copy?" },
    { label: "I'm stuck", message: "I'm stuck. What should I do?" },
  ],
  data: [
    { label: "See performance", message: "How do I see my ad performance?" },
    { label: "Import campaigns", message: "How do I import my Meta campaigns?" },
    { label: "Optimize ads", message: "How do I know which ads to optimize?" },
    { label: "Something wrong", message: "Something doesn't look right here." },
  ],
  settings: [
    { label: "Billing", message: "Where do I manage my subscription?" },
    { label: "Meta settings", message: "How do I change my Meta connection?" },
    { label: "Email reports", message: "How do I set up weekly email reports?" },
    { label: "Need help", message: "What can I do on this page?" },
  ],
  'angle-feedback': [
    { label: "I love these!", message: "These angles are great! Let's build on them and create the hooks and concepts." },
    { label: "Let's refine them", message: "I'd like to chat about my offer and audience to make these angles even more powerful." },
    { label: "Different direction", message: "I want to explore a different creative direction. Let me tell you more about what I'm looking for." },
    { label: "Tell me more", message: "Can you explain why you chose these specific angles for my offer?" },
  ],
  campaign: [
    { label: "Review settings", message: "Can you help me understand these campaign settings?" },
    { label: "What's next?", message: "What should I do next with this campaign?" },
    { label: "Need help", message: "I need help with this step." },
    { label: "Something wrong", message: "Something doesn't look right here." },
  ],
  production: [
    { label: "Get started", message: "How do I get started with production?" },
    { label: "Upload assets", message: "How do I upload my creative assets?" },
    { label: "Need help", message: "I need help understanding this page." },
    { label: "Something wrong", message: "Something doesn't look right here." },
  ],
  'add-creative': [
    { label: "Upload guidance", message: "How do I upload my creative assets?" },
    { label: "Get started", message: "How do I get started here?" },
    { label: "Need help", message: "I need help with this step." },
    { label: "Something wrong", message: "Something doesn't look right here." },
  ],
};

export function LumiChat({ context, workspace, brand, trigger, autoOpen = false, onOpenChange, customStarters, initialMessage, generatedAngles, onSaveInsights }: LumiChatProps) {
  const [internalOpen, setInternalOpen] = useState(autoOpen);
  const { messages, addMessage, setBrandId, clearMessages } = useLumi();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [hasShownInitialMessage, setHasShownInitialMessage] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const starters = customStarters || contextStarters[context] || contextStarters.dashboard;

  // Fetch user email for bug reports
  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUserEmail();
  }, []);

  const open = internalOpen;
  const setOpen = (value: boolean) => {
    // Save insights when closing the chat (only for angle-feedback context with meaningful conversation)
    if (!value && open && context === 'angle-feedback' && messages.length > 1 && onSaveInsights) {
      const insights: ConversationInsight = {
        timestamp: new Date().toISOString(),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      };
      onSaveInsights(insights);
    }
    
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  // Auto-open on mount if autoOpen is true
  useEffect(() => {
    if (autoOpen) {
      setInternalOpen(true);
    }
  }, [autoOpen]);

  // Handle navigation action click
  const handleActionClick = (action: NavigationAction) => {
    if (action.type === 'navigate' && action.route) {
      navigate(action.route);
      setOpen(false);
    } else if (action.type === 'bug_report') {
      setBugReportOpen(true);
    }
  };
  
  // Show initial message from Lumi when chat opens (proactive conversation)
  useEffect(() => {
    if (open && initialMessage && !hasShownInitialMessage && messages.length === 0) {
      // Clear any previous messages and show Lumi's proactive message
      clearMessages();
      const lumiMessage: Message = {
        role: 'assistant',
        content: initialMessage,
        followups: [
          { label: "Yes, let's chat!", message: "I'd love to discuss my offer and audience to get better angles." },
          { label: "These look good", message: "I'm happy with these angles. Let's move forward to creating hooks and concepts." },
        ]
      };
      addMessage(lumiMessage);
      setHasShownInitialMessage(true);
    }
  }, [open, initialMessage, hasShownInitialMessage, messages.length, addMessage, clearMessages]);

  const copyToClipboard = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Set brand ID when brand changes
  useEffect(() => {
    if (brand?.id) {
      setBrandId(brand.id);
    }
  }, [brand?.id, setBrandId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    addMessage(userMessage);
    setInput("");
    setIsLoading(true);

    try {
      const contextInfo = {
        context,
        workspace: workspace ? {
          name: workspace.name,
          offer_name: workspace.offer_name,
          offer_description: workspace.offer_description,
          progress_status: workspace.progress_status,
        } : null,
        brand: brand ? {
          name: brand.name,
          industry: brand.industry,
          target_audience: brand.target_audience,
        } : null,
        generatedAngles: generatedAngles || null,
      };

      const { data, error } = await supabase.functions.invoke('lumi-chat', {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          context: contextInfo,
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || "I'm sorry, I couldn't process that. Please try again.",
        actions: data.actions || [],
        followups: data.followups || [],
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

  // Default trigger if none provided
  const defaultTrigger = (
    <Button
      className="fixed bottom-6 right-6 h-16 px-6 rounded-full shadow-glow bg-gradient-lumi hover:opacity-90 text-white gap-3 z-50 group"
      size="lg"
    >
      <SparkleIcon size="md" state="idle" glow className="group-hover:animate-none" />
      <span className="font-semibold text-base">Ask Lumi</span>
    </Button>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger || defaultTrigger}
      </DrawerTrigger>
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparkleIcon size="md" state={isLoading ? "thinking" : "idle"} glow />
              <div>
                <DrawerTitle className="text-lg font-display">Lumi</DrawerTitle>
                <p className="text-xs text-muted-foreground">Meta Ads, Simplified.</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setBugReportOpen(true)}
              >
                <Bug className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Report Bug</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        {/* Bug Report Modal */}
        <BugReportModal 
          open={bugReportOpen} 
          onOpenChange={setBugReportOpen}
          context={context}
          recentMessages={messages.map(m => ({ role: m.role, content: m.content }))}
          userEmail={userEmail}
        />

        <div className="flex flex-col h-[calc(85vh-120px)]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <SparkleIcon size="lg" state="idle" glow className="mx-auto mb-4" />
                  <h3 className="font-display font-semibold mb-2">How can I help? 👋</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    I'll guide you to the right place in the app.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                    <Sparkle className="h-4 w-4 animate-sparkle-pulse" />
                    <span>Common questions</span>
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
                  <div key={idx} className="space-y-2">
                    <div
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
                    >
                      {message.role === 'assistant' && (
                        <SparkleIcon size="sm" state="idle" className="mr-2 flex-shrink-0 mt-1" />
                      )}
                      <div className="relative max-w-[80%]">
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap select-text">{message.content}</p>
                        </div>
                        {/* Navigation Action Buttons */}
                        {message.actions && message.actions.length > 0 && (
                          <div className="flex flex-col gap-2 mt-2">
                            {message.actions.map((action, actionIdx) => (
                              <Button
                                key={actionIdx}
                                size="sm"
                                onClick={() => handleActionClick(action)}
                                className={cn(
                                  "justify-start gap-2 h-auto py-2 px-3 text-sm",
                                  action.type === 'navigate' 
                                    ? "bg-gradient-lumi text-white hover:opacity-90" 
                                    : "variant-outline"
                                )}
                              >
                                {action.type === 'navigate' && <ArrowRight className="h-4 w-4" />}
                                {action.type === 'bug_report' && <Bug className="h-4 w-4" />}
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        )}
                        {/* Copy button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -right-8 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(message.content, idx)}
                        >
                          {copiedIdx === idx ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Follow-up suggestions and action buttons after the latest assistant message */}
                    {message.role === 'assistant' && idx === messages.length - 1 && !isLoading && (
                      <div className="space-y-2 ml-10">
                        {/* Follow-up suggestions */}
                        {message.followups && message.followups.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {message.followups.map((followup, fIdx) => (
                              <Button
                                key={fIdx}
                                variant="ghost"
                                size="sm"
                                className="h-auto py-1.5 px-3 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => sendMessage(followup.message)}
                              >
                                {followup.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <SparkleIcon size="sm" state="thinking" className="mr-2" />
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
  );
}
