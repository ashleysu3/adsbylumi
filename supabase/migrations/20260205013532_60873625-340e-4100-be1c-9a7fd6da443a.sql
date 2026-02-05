-- 1. Add new columns to knowledge_documents
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- 2. Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage site settings
CREATE POLICY "Admins can manage site settings"
  ON site_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Everyone can read site settings
CREATE POLICY "Anyone can read site settings"
  ON site_settings FOR SELECT TO authenticated
  USING (true);

-- 3. Insert default banner setting
INSERT INTO site_settings (key, value) VALUES (
  'announcement_banner',
  '{"enabled": false, "text": "", "style": "brand", "dismissible": true}'::jsonb
) ON CONFLICT (key) DO NOTHING;