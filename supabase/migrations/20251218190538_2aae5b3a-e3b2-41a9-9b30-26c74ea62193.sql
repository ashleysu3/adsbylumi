-- Add sort_order column to campaign_templates for drag-and-drop reordering
ALTER TABLE public.campaign_templates 
ADD COLUMN sort_order integer DEFAULT 0;

-- Initialize sort_order based on current order by name
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
  FROM public.campaign_templates
)
UPDATE public.campaign_templates ct
SET sort_order = o.rn
FROM ordered o
WHERE ct.id = o.id;