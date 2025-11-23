import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface CampaignChatProps {
  workspace: any;
  chatHistory: any[];
  answers: any;
  onAnswerUpdate: (answers: any) => void;
  onChatUpdate: (messages: any[]) => void;
  onComplete: () => void;
}

export function CampaignChat({
  workspace,
  chatHistory,
  answers,
  onAnswerUpdate,
  onChatUpdate,
  onComplete
}: CampaignChatProps) {
  const [messages, setMessages] = useState<any[]>(chatHistory || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // If no messages yet and not initialized, send initial greeting
    if (messages.length === 0 && !initializedRef.current) {
      initializedRef.current = true;
      sendInitialMessage();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendInitialMessage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('campaign-builder-chat', {
        body: {
          workspaceId: workspace.id,
          message: null,
          chatHistory: [],
          answers: {}
        }
      });

      if (error) throw error;

      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        recommendations: data.recommendations
      };

      const newMessages = [assistantMessage];
      setMessages(newMessages);
      onChatUpdate(newMessages);
      setRecommendations(data.recommendations || []);
    } catch (error: any) {
      console.error('Error sending initial message:', error);
      toast.error("Failed to start conversation");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend) return;

    const userMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    onChatUpdate(newMessages);
    setInput("");
    setRecommendations([]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('campaign-builder-chat', {
        body: {
          workspaceId: workspace.id,
          message: textToSend,
          chatHistory: newMessages,
          answers
        }
      });

      if (error) throw error;

      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        recommendations: data.recommendations
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
      onChatUpdate(updatedMessages);

      // Update answers if provided
      if (data.answers) {
        onAnswerUpdate(data.answers);
      }

      // Set recommendations for quick replies
      setRecommendations(data.recommendations || []);

      // Check if complete
      if (data.stage === 'complete') {
        setTimeout(() => {
          onComplete();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message");
      
      // Remove user message on error
      setMessages(messages);
      onChatUpdate(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReply = (recommendation: any) => {
    // Send the actual value, not the label
    const valueToSend = String(recommendation.value);
    sendMessage(valueToSend);
  };

  return (
    <Card className="h-[calc(100vh-220px)] flex flex-col">
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-8">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className={message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              
              <div className={`flex-1 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                <div
                  className={`rounded-lg px-4 py-3 max-w-[85%] break-words ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        {recommendations.length > 0 && !loading && (
          <div className="border-t bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground">Recommended Options</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((rec, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickReply(rec)}
                  className="text-xs whitespace-normal h-auto py-2"
                >
                  <span className="break-words">{rec.label}</span>
                  {rec.reason && (
                    <span className="ml-2 text-muted-foreground">• {rec.reason}</span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
