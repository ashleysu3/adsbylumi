-- Enable pg_net extension for HTTP calls from database functions
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Update handle_new_user to also notify Slack via pg_net
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Give new users the 'user' role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Fire-and-forget Slack notification via edge function
  PERFORM net.http_post(
    url := 'https://sqwjbndgighjtifijgws.supabase.co/functions/v1/slack-new-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd2pibmRnaWdoanRpZmlqZ3dzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjU0ODYsImV4cCI6MjA3OTE0MTQ4Nn0.ZhUb6v64dbzutHpzbQEG4BIw3PFMow-X-WXfucsBHA0'
    ),
    body := jsonb_build_object(
      'email', NEW.email,
      'full_name', COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
  );
  
  RETURN NEW;
END;
$function$;