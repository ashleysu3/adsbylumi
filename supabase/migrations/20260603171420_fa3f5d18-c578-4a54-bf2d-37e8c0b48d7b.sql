-- inspiration_items: global curated library
CREATE TABLE public.inspiration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  title text,
  source text DEFAULT 'curated',
  tags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inspiration_items TO authenticated;
GRANT ALL ON public.inspiration_items TO service_role;

ALTER TABLE public.inspiration_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view inspiration"
  ON public.inspiration_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert inspiration"
  ON public.inspiration_items FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update inspiration"
  ON public.inspiration_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete inspiration"
  ON public.inspiration_items FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- boards: per-user
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own boards"
  ON public.boards FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- board_items
CREATE TABLE public.board_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  inspiration_item_id uuid REFERENCES public.inspiration_items(id) ON DELETE SET NULL,
  uploaded_image_url text,
  note text,
  status text NOT NULL DEFAULT 'private',
  tags jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_items TO authenticated;
GRANT ALL ON public.board_items TO service_role;

ALTER TABLE public.board_items ENABLE ROW LEVEL SECURITY;

-- Status validation trigger (no CHECK constraints per project rules)
CREATE OR REPLACE FUNCTION public.validate_board_item_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('private', 'pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be private, pending, approved, or rejected.', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_board_item_status_trg
  BEFORE INSERT OR UPDATE ON public.board_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_board_item_status();

CREATE POLICY "Users manage their own board items"
  ON public.board_items FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all board items"
  ON public.board_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update any board item"
  ON public.board_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_board_items_board ON public.board_items(board_id);
CREATE INDEX idx_board_items_pending ON public.board_items(status) WHERE status = 'pending';
CREATE INDEX idx_boards_user ON public.boards(user_id);