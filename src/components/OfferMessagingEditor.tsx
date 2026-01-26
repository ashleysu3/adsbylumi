import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, X, MessageSquare, Sparkles } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AutoSaveIndicator, SaveStatus } from '@/components/AutoSaveIndicator';

interface MessagingGuidelines {
  core_message?: string;
  key_benefits?: string[];
  tone_notes?: string;
  dont_say?: string[];
  always_include?: string[];
  approved_examples?: Array<{ type: string; text: string }>;
  competitor_differentiation?: string;
}

interface OfferMessagingEditorProps {
  offerId: string;
  offerName: string;
  initialGuidelines?: MessagingGuidelines;
  onUpdate?: (guidelines: MessagingGuidelines) => void;
}

export function OfferMessagingEditor({
  offerId,
  offerName,
  initialGuidelines,
  onUpdate
}: OfferMessagingEditorProps) {
  const [guidelines, setGuidelines] = useState<MessagingGuidelines>(initialGuidelines || {});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [newBenefit, setNewBenefit] = useState('');
  const [newDontSay, setNewDontSay] = useState('');
  const [newAlwaysInclude, setNewAlwaysInclude] = useState('');
  const [newExample, setNewExample] = useState({ type: 'headline', text: '' });
  
  // Track if we've made any changes (to avoid saving on initial load)
  const hasChangedRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (initialGuidelines) {
      setGuidelines(initialGuidelines);
      // Mark initial load complete after a tick
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [initialGuidelines]);

  // Auto-save function
  const performSave = useCallback(async (guidelinesToSave: MessagingGuidelines) => {
    setSaveStatus("saving");
    try {
      const { error } = await supabase
        .from('offers')
        .update({ messaging_guidelines: JSON.parse(JSON.stringify(guidelinesToSave)) })
        .eq('id', offerId);

      if (error) throw error;
      
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      onUpdate?.(guidelinesToSave);
    } catch (error) {
      console.error('Error saving messaging guidelines:', error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [offerId, onUpdate]);

  // Debounced auto-save when guidelines change
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) return;
    
    // Skip if no meaningful content
    const hasContent = guidelines.core_message || 
      (guidelines.key_benefits?.length || 0) > 0 ||
      (guidelines.dont_say?.length || 0) > 0 ||
      (guidelines.always_include?.length || 0) > 0 ||
      (guidelines.approved_examples?.length || 0) > 0 ||
      guidelines.tone_notes ||
      guidelines.competitor_differentiation;
    
    if (!hasContent) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 1.5 seconds
    saveTimeoutRef.current = setTimeout(() => {
      performSave(guidelines);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [guidelines, performSave]);

  const addToArray = (field: keyof MessagingGuidelines, value: string, clearFn: () => void) => {
    if (!value.trim()) return;
    const current = (guidelines[field] as string[]) || [];
    setGuidelines(prev => ({
      ...prev,
      [field]: [...current, value.trim()]
    }));
    clearFn();
  };

  const removeFromArray = (field: keyof MessagingGuidelines, index: number) => {
    const current = (guidelines[field] as string[]) || [];
    setGuidelines(prev => ({
      ...prev,
      [field]: current.filter((_, i) => i !== index)
    }));
  };

  const addExample = () => {
    if (!newExample.text.trim()) return;
    const current = guidelines.approved_examples || [];
    setGuidelines(prev => ({
      ...prev,
      approved_examples: [...current, { ...newExample }]
    }));
    setNewExample({ type: 'headline', text: '' });
  };

  const removeExample = (index: number) => {
    const current = guidelines.approved_examples || [];
    setGuidelines(prev => ({
      ...prev,
      approved_examples: current.filter((_, i) => i !== index)
    }));
  };

  const hasContent = guidelines.core_message || 
    (guidelines.key_benefits?.length || 0) > 0 ||
    (guidelines.dont_say?.length || 0) > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Messaging Guidelines</span>
            {hasContent && (
              <Badge variant="secondary" className="text-xs">
                Configured
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOpen && <AutoSaveIndicator status={saveStatus} size="sm" />}
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Core Message */}
        <div className="space-y-2">
          <Label>Core Message</Label>
          <p className="text-xs text-muted-foreground">The single most important thing about this offer</p>
          <Textarea
            value={guidelines.core_message || ''}
            onChange={(e) => setGuidelines(prev => ({ ...prev, core_message: e.target.value }))}
            placeholder="e.g., Get your first paying client within 30 days using our proven framework"
            className="min-h-[80px]"
          />
        </div>

        {/* Key Benefits */}
        <div className="space-y-2">
          <Label>Key Benefits</Label>
          <p className="text-xs text-muted-foreground">Main benefits to highlight in ads</p>
          <div className="flex gap-2">
            <Input
              value={newBenefit}
              onChange={(e) => setNewBenefit(e.target.value)}
              placeholder="Add a benefit..."
              onKeyDown={(e) => e.key === 'Enter' && addToArray('key_benefits', newBenefit, () => setNewBenefit(''))}
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => addToArray('key_benefits', newBenefit, () => setNewBenefit(''))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(guidelines.key_benefits || []).map((benefit, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {benefit}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeFromArray('key_benefits', i)}
                />
              </Badge>
            ))}
          </div>
        </div>

        {/* Tone Notes */}
        <div className="space-y-2">
          <Label>Tone & Voice Notes</Label>
          <p className="text-xs text-muted-foreground">Specific tone guidance for this offer</p>
          <Textarea
            value={guidelines.tone_notes || ''}
            onChange={(e) => setGuidelines(prev => ({ ...prev, tone_notes: e.target.value }))}
            placeholder="e.g., More urgent and direct than usual brand voice. Emphasize scarcity."
            className="min-h-[60px]"
          />
        </div>

        {/* Don't Say */}
        <div className="space-y-2">
          <Label className="text-destructive">Don't Say</Label>
          <p className="text-xs text-muted-foreground">Words/phrases to avoid in ads</p>
          <div className="flex gap-2">
            <Input
              value={newDontSay}
              onChange={(e) => setNewDontSay(e.target.value)}
              placeholder="Add phrase to avoid..."
              onKeyDown={(e) => e.key === 'Enter' && addToArray('dont_say', newDontSay, () => setNewDontSay(''))}
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => addToArray('dont_say', newDontSay, () => setNewDontSay(''))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(guidelines.dont_say || []).map((phrase, i) => (
              <Badge key={i} variant="destructive" className="gap-1">
                {phrase}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeFromArray('dont_say', i)}
                />
              </Badge>
            ))}
          </div>
        </div>

        {/* Always Include */}
        <div className="space-y-2">
          <Label className="text-green-600">Always Include</Label>
          <p className="text-xs text-muted-foreground">Must-mention elements in every ad</p>
          <div className="flex gap-2">
            <Input
              value={newAlwaysInclude}
              onChange={(e) => setNewAlwaysInclude(e.target.value)}
              placeholder="Add must-include element..."
              onKeyDown={(e) => e.key === 'Enter' && addToArray('always_include', newAlwaysInclude, () => setNewAlwaysInclude(''))}
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => addToArray('always_include', newAlwaysInclude, () => setNewAlwaysInclude(''))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(guidelines.always_include || []).map((item, i) => (
              <Badge key={i} className="gap-1 bg-green-600">
                {item}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => removeFromArray('always_include', i)}
                />
              </Badge>
            ))}
          </div>
        </div>

        {/* Competitor Differentiation */}
        <div className="space-y-2">
          <Label>Competitor Differentiation</Label>
          <p className="text-xs text-muted-foreground">What makes this different from alternatives?</p>
          <Textarea
            value={guidelines.competitor_differentiation || ''}
            onChange={(e) => setGuidelines(prev => ({ ...prev, competitor_differentiation: e.target.value }))}
            placeholder="e.g., Unlike courses, this is done-with-you. Unlike agencies, you learn the skills."
            className="min-h-[60px]"
          />
        </div>

        {/* Approved Examples */}
        <div className="space-y-2">
          <Label>Approved Copy Examples</Label>
          <p className="text-xs text-muted-foreground">Copy that works well for this offer (AI will learn from these)</p>
          <div className="flex gap-2">
            <select
              value={newExample.type}
              onChange={(e) => setNewExample(prev => ({ ...prev, type: e.target.value }))}
              className="px-3 py-2 border rounded-md text-sm bg-background"
            >
              <option value="headline">Headline</option>
              <option value="hook">Hook</option>
              <option value="body">Body Copy</option>
              <option value="cta">CTA</option>
            </select>
            <Input
              value={newExample.text}
              onChange={(e) => setNewExample(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Add approved copy..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addExample()}
            />
            <Button size="sm" variant="outline" onClick={addExample}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {(guidelines.approved_examples || []).map((example, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-muted rounded-md">
                <Badge variant="outline" className="shrink-0">{example.type}</Badge>
                <span className="text-sm flex-1">{example.text}</span>
                <X 
                  className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive shrink-0" 
                  onClick={() => removeExample(i)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Auto-save status indicator at bottom */}
        <div className="flex items-center justify-center pt-2 border-t">
          <AutoSaveIndicator status={saveStatus} showLabel />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
