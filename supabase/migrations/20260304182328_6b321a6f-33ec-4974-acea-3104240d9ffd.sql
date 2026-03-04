ALTER TABLE public.profiles 
  ADD COLUMN is_beta_user boolean NOT NULL DEFAULT false,
  ADD COLUMN beta_feedback_email_sent boolean NOT NULL DEFAULT false;