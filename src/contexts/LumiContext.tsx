import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface FollowUp {
  label: string;
  message: string;
}

export interface NavigationAction {
  type: 'navigate' | 'bug_report' | 'contact_support';
  label: string;
  route?: string;
  description?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  followups?: FollowUp[];
  actions?: NavigationAction[];
}

interface LumiContextType {
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  brandId: string | null;
  setBrandId: (id: string | null) => void;
}

const LumiContext = createContext<LumiContextType | undefined>(undefined);

export function LumiProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [brandId, setBrandIdState] = useState<string | null>(null);

  const setBrandId = useCallback((id: string | null) => {
    setBrandIdState(prev => {
      if (id !== prev) {
        setMessages([]);
        return id;
      }
      return prev;
    });
  }, []);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <LumiContext.Provider value={{ messages, addMessage, clearMessages, brandId, setBrandId }}>
      {children}
    </LumiContext.Provider>
  );
}

export function useLumi() {
  const context = useContext(LumiContext);
  if (context === undefined) {
    throw new Error('useLumi must be used within a LumiProvider');
  }
  return context;
}
