-- Create enum for subscription tiers
CREATE TYPE public.subscription_tier AS ENUM ('starter', 'growth', 'agency_pro');

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Create brands table
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT,
  industry TEXT,
  brand_voice TEXT,
  target_audience TEXT,
  value_proposition TEXT,
  meta_account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offers table
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_point TEXT,
  target_outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audiences table with psychology profiles
CREATE TABLE public.audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  demographics TEXT,
  psychographics TEXT,
  pain_points TEXT[],
  desires TEXT[],
  objections TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create strategies table (output from Ad Planner)
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL, -- Training, Cold, Warm
  messaging_framework JSONB,
  audience_psychology JSONB,
  optimization_goals TEXT[],
  kpi_benchmarks JSONB,
  contextual_keywords TEXT[],
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  tier subscription_tier NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for brands
CREATE POLICY "Users can view their own brands"
  ON public.brands FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brands"
  ON public.brands FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brands"
  ON public.brands FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brands"
  ON public.brands FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for offers
CREATE POLICY "Users can view offers for their brands"
  ON public.offers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = offers.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert offers for their brands"
  ON public.offers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = offers.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update offers for their brands"
  ON public.offers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = offers.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete offers for their brands"
  ON public.offers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = offers.brand_id AND brands.user_id = auth.uid()
    )
  );

-- RLS Policies for audiences (same pattern as offers)
CREATE POLICY "Users can view audiences for their brands"
  ON public.audiences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = audiences.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert audiences for their brands"
  ON public.audiences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = audiences.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update audiences for their brands"
  ON public.audiences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = audiences.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete audiences for their brands"
  ON public.audiences FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = audiences.brand_id AND brands.user_id = auth.uid()
    )
  );

-- RLS Policies for strategies
CREATE POLICY "Users can view strategies for their brands"
  ON public.strategies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = strategies.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert strategies for their brands"
  ON public.strategies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = strategies.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update strategies for their brands"
  ON public.strategies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = strategies.brand_id AND brands.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete strategies for their brands"
  ON public.strategies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = strategies.brand_id AND brands.user_id = auth.uid()
    )
  );

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();