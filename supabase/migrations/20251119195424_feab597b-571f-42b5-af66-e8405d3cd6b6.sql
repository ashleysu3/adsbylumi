-- Create knowledge_documents table for admin-managed content
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('ad_planner', 'creative_department', 'hooks', 'copy_formulas', 'visual_guidelines', 'psychology', 'meta_best_practices')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  version INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read active knowledge
CREATE POLICY "Authenticated users can read active knowledge"
  ON public.knowledge_documents
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Policy: Only admins can manage knowledge
CREATE POLICY "Admins can insert knowledge"
  ON public.knowledge_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update knowledge"
  ON public.knowledge_documents
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete knowledge"
  ON public.knowledge_documents
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_knowledge_category ON public.knowledge_documents(category);
CREATE INDEX idx_knowledge_active ON public.knowledge_documents(active);
CREATE INDEX idx_knowledge_tags ON public.knowledge_documents USING GIN(tags);

-- Insert default knowledge base entries
INSERT INTO public.knowledge_documents (category, title, content, tags) VALUES
('meta_best_practices', 'Meta Ads Campaign Structure', 'Use ABO (Ad Set Budget Optimization) for better control. Enable Advantage+ Campaign Budget when scaling. Always test 3-5 creatives per ad set. Broad targeting often outperforms detailed targeting with sufficient budget.', ARRAY['campaign-structure', 'optimization']),
('hooks', 'Visual Hook Patterns', 'Pattern interrupts work best in first 3 seconds. Use contrasting colors, unexpected movements, or bold text overlays. Question-based hooks increase watch time by 40%.', ARRAY['video', 'engagement']),
('copy_formulas', 'PAS Framework', 'Problem → Agitate → Solution. Start with relatable pain point, amplify the frustration, then present your offer as the solution. Works best for conversion-focused ads.', ARRAY['copywriting', 'conversion']),
('psychology', 'Loss Aversion Triggers', 'People are 2x more motivated to avoid loss than gain something. Use scarcity, urgency, and FOMO in messaging. Limited spots, deadline-driven offers, social proof of others taking action.', ARRAY['psychology', 'conversion']),
('creative_department', 'Talking Head Best Practices', 'Shoot in 9:16 for Reels/Stories. Use good lighting (ring light or natural window light). Keep scripts under 60 seconds. First 3 seconds must hook attention. Include text overlays for sound-off viewing.', ARRAY['video-production', 'best-practices'])
ON CONFLICT DO NOTHING;