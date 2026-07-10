-- Persists in-progress funnel-map chat conversations so closing the chat
-- before finishing doesn't lose the user's answers. Cleared once the
-- funnel map is actually saved (funnel_map becomes the source of truth).
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS funnel_chat_draft JSONB;
