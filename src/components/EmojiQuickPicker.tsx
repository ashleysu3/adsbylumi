import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Sparkles, Zap, Heart, Trophy, Clock, Gift, Target, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmojiQuickPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  selectedEmojis?: string[];
}

const EMOJI_CATEGORIES = {
  engagement: {
    label: 'Engagement',
    icon: Sparkles,
    description: 'Attention-grabbing',
    emojis: ['✨', '🔥', '💫', '⭐', '🌟', '💥', '🎉', '🙌', '👀', '💬', '❤️', '💜']
  },
  urgency: {
    label: 'Urgency',
    icon: Clock,
    description: 'Time-sensitive CTAs',
    emojis: ['⏰', '🚨', '⚡', '🏃', '⏳', '🔔', '📢', '💨', '🎯', '❗', '⚠️', '🆕']
  },
  benefits: {
    label: 'Benefits',
    icon: Gift,
    description: 'Value & outcomes',
    emojis: ['💰', '💵', '📈', '🎁', '✅', '💪', '🏆', '🥇', '💎', '👑', '🌈', '🔑']
  },
  action: {
    label: 'Action',
    icon: Target,
    description: 'Call-to-action',
    emojis: ['👉', '➡️', '🎯', '🚀', '💡', '📲', '🔗', '📧', '✍️', '📝', '🛒', '💳']
  },
  emotion: {
    label: 'Emotion',
    icon: Heart,
    description: 'Emotional triggers',
    emojis: ['❤️', '😍', '🥰', '😊', '🤩', '😮', '🤯', '💖', '💕', '🙏', '😱', '🤔']
  },
  trust: {
    label: 'Trust',
    icon: Trophy,
    description: 'Credibility signals',
    emojis: ['✓', '🏅', '📊', '💯', '🤝', '🛡️', '🔒', '⭐', '👍', '💼', '📋', '🎖️']
  },
};

export default function EmojiQuickPicker({ onSelect, disabled, selectedEmojis = [] }: EmojiQuickPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Quick Pick
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 bg-popover border shadow-lg z-50" 
        align="start"
        sideOffset={8}
      >
        <div className="p-3 border-b bg-muted/30">
          <h4 className="font-medium text-sm">Meta Ad Emojis</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Popular emojis organized for high-converting ads
          </p>
        </div>
        
        <Tabs defaultValue="engagement" className="w-full">
          <TabsList className="w-full justify-start gap-0 h-auto p-1 bg-muted/30 rounded-none border-b flex-wrap">
            {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => {
              const Icon = category.icon;
              return (
                <TabsTrigger 
                  key={key} 
                  value={key}
                  className="text-xs gap-1 px-2 py-1.5 data-[state=active]:bg-background"
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{category.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
            <TabsContent key={key} value={key} className="mt-0 p-3">
              <p className="text-xs text-muted-foreground mb-2">{category.description}</p>
              <div className="grid grid-cols-6 gap-1">
                {category.emojis.map((emoji) => {
                  const isSelected = selectedEmojis.includes(emoji);
                  return (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      disabled={isSelected}
                      onClick={() => handleSelect(emoji)}
                      className={cn(
                        "h-9 w-9 p-0 text-lg hover:bg-primary/10 hover:scale-110 transition-transform",
                        isSelected && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {emoji}
                    </Button>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        <div className="p-2 border-t bg-muted/20">
          <p className="text-[10px] text-muted-foreground text-center">
            💡 Meta research shows strategic emoji use can boost CTR by 25%
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
