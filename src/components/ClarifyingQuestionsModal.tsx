import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, MessageCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Question {
  id: string;
  question: string;
  context: string;
  field: string;
  table: string;
  recordId: string;
  inputType: 'text' | 'textarea' | 'select';
  options?: string[];
  priority: 'critical' | 'important' | 'helpful';
}

interface ClarifyingQuestionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: Question[];
  onComplete: () => void;
  onSkip?: () => void;
}

export function ClarifyingQuestionsModal({
  open,
  onOpenChange,
  questions,
  onComplete,
  onSkip
}: ClarifyingQuestionsModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const currentQuestion = questions[currentIndex];

  const handleAnswerChange = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const saveAnswer = async () => {
    if (!currentQuestion || !answers[currentQuestion.id]) return;

    setSaving(true);
    try {
      const { table, recordId, field } = currentQuestion;
      const value = answers[currentQuestion.id];

      // Handle nested field paths (e.g., 'messaging_guidelines.core_message')
      if (field.includes('.')) {
        const [parentField, childField] = field.split('.');
        
        // Fetch current value first
        const { data: current } = await supabase
          .from(table as any)
          .select(parentField)
          .eq('id', recordId)
          .single();

        const currentValue = (current as any)?.[parentField] || {};
        
        // Handle array fields (dont_say, always_include, etc.)
        let newChildValue: any = value;
        if (childField === 'dont_say' || childField === 'always_include' || childField === 'key_benefits') {
          newChildValue = value.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        const updatedValue = {
          ...currentValue,
          [childField]: newChildValue
        };

        await supabase
          .from(table as any)
          .update({ [parentField]: updatedValue })
          .eq('id', recordId);
      } else if (field === 'audience_psychology_input') {
        // Special handling - trigger psychology generation
        await supabase
          .from(table as any)
          .update({ 
            target_audience: value,
            psychology_status: 'pending'
          })
          .eq('id', recordId);
      } else if (field === 'product_psychology_objections') {
        // Special handling for product psychology objections
        const { data: current } = await supabase
          .from(table as any)
          .select('product_psychology')
          .eq('id', recordId)
          .single();

        const currentPsychology = (current as any)?.product_psychology || {};
        const objections = value.split(',').map((s: string) => s.trim()).filter(Boolean);

        await supabase
          .from(table as any)
          .update({
            product_psychology: {
              ...currentPsychology,
              objections
            }
          })
          .eq('id', recordId);
      } else {
        // Direct field update
        await supabase
          .from(table as any)
          .update({ [field]: value })
          .eq('id', recordId);
      }

      // Move to next question or complete
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        toast.success('Great! I have what I need to create better ads.');
        onComplete();
      }
    } catch (error) {
      console.error('Error saving answer:', error);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (onSkip) {
        onSkip();
      } else {
        onComplete();
      }
  };

  if (!currentQuestion) return null;

  const priorityColors = {
    critical: 'destructive',
    important: 'default',
    helpful: 'secondary'
  } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Quick Question
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <Badge variant={priorityColors[currentQuestion.priority]}>
              {currentQuestion.priority}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-base font-medium">
              {currentQuestion.question}
            </Label>
            <p className="text-sm text-muted-foreground">
              {currentQuestion.context}
            </p>
          </div>

          {currentQuestion.inputType === 'textarea' ? (
            <Textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              className="min-h-[120px]"
              autoFocus
            />
          ) : (
            <Input
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              autoFocus
            />
          )}
        </div>

        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={saving}
          >
            Skip for now
          </Button>
          <Button
            onClick={saveAnswer}
            disabled={!answers[currentQuestion.id] || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {currentIndex < questions.length - 1 ? 'Next' : 'Generate Creative'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
