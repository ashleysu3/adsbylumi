import { useState, useRef, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Send, Loader2, X, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LumiCharacter } from "./LumiCharacter";
import { useLumi } from "@/contexts/LumiContext";

interface LumiChatProps {
  context: 'creative' | 'planning' | 'data' | 'campaign' | 'dashboard' | 'settings' | 'campaigns' | 'production';
  workspace?: any;
  brand?: any;
  trigger?: ReactNode;
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

export function LumiChat({ context, workspace, brand, trigger }: LumiChatProps) {
  const [open, setOpen] = useState(false);
  const { messages, addMessage, setBrandId } = useLumi();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const starters = contextStarters[context] || contextStarters.dashboard;

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

  // Default trigger if none provided
  const defaultTrigger = (
    <Button
      className="fixed bottom-6 right-6 h-16 px-6 rounded-full shadow-glow bg-gradient-lumi hover:opacity-90 text-white gap-3 z-50 group"
      size="lg"
    >
      <LumiCharacter size="md" state="idle" glow className="group-hover:animate-none" />
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
              <LumiCharacter size="md" state={isLoading ? "thinking" : "idle"} glow />
              <div>
                <DrawerTitle className="text-lg font-display">Lumi</DrawerTitle>
                <p className="text-xs text-muted-foreground">Meta Ads, Simplified.</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
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
                    <Lightbulb className="h-4 w-4" />
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
  );
}
