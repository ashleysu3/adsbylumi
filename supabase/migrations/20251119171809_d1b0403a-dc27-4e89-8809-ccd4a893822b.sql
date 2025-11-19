-- Add recommendation fields to offers table
ALTER TABLE offers 
ADD COLUMN recommended_template_id uuid REFERENCES campaign_templates(id),
ADD COLUMN recommendation_reason text,
ADD COLUMN recommendation_confidence text CHECK (recommendation_confidence IN ('high', 'medium', 'low'));