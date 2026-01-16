-- Create content_ideas table for storing content ideas organized by offer
CREATE TABLE public.content_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'idea',
  status TEXT NOT NULL DEFAULT 'idea',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_ideas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view content ideas for their brands"
ON public.content_ideas FOR SELECT
USING (EXISTS (
  SELECT 1 FROM brands
  WHERE brands.id = content_ideas.brand_id
  AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can insert content ideas for their brands"
ON public.content_ideas FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM brands
  WHERE brands.id = content_ideas.brand_id
  AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can update content ideas for their brands"
ON public.content_ideas FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM brands
  WHERE brands.id = content_ideas.brand_id
  AND brands.user_id = auth.uid()
));

CREATE POLICY "Users can delete content ideas for their brands"
ON public.content_ideas FOR DELETE
USING (EXISTS (
  SELECT 1 FROM brands
  WHERE brands.id = content_ideas.brand_id
  AND brands.user_id = auth.uid()
));

-- Create index for faster queries
CREATE INDEX idx_content_ideas_brand_id ON public.content_ideas(brand_id);
CREATE INDEX idx_content_ideas_offer_id ON public.content_ideas(offer_id);

-- Update trigger for updated_at
CREATE TRIGGER update_content_ideas_updated_at
BEFORE UPDATE ON public.content_ideas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();