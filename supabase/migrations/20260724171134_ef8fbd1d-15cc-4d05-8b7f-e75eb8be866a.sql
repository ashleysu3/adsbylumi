-- Finding 1: brands table lost write grants; RLS alone cannot allow writes without table privileges.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;