import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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
    // Clear messages when brand changes
    if (id !== brandId) {
      setMessages([]);
      setBrandIdState(id);
    }
  }, [brandId]);

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
