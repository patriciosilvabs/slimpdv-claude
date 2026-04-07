-- Create complement_groups table (Grupos de Complemento)
CREATE TABLE public.complement_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  selection_type TEXT NOT NULL DEFAULT 'single' CHECK (selection_type IN ('single', 'multiple', 'multiple_repeat')),
  is_required BOOLEAN DEFAULT false,
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  visibility TEXT DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
  channels TEXT[] DEFAULT ARRAY['delivery', 'counter', 'table'],
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create complement_options table (Opções de Complemento)
CREATE TABLE public.complement_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  internal_code TEXT,
  pdv_code TEXT,
  auto_calculate_cost BOOLEAN DEFAULT false,
  enable_stock_control BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create complement_group_options table (Ligação Grupo-Opção)
CREATE TABLE public.complement_group_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.complement_groups(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.complement_options(id) ON DELETE CASCADE,
  price_override NUMERIC,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(group_id, option_id)
);

-- Create product_complement_groups table (Ligação Produto-Grupo)
CREATE TABLE public.product_complement_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.complement_groups(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, group_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.complement_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complement_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complement_group_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_complement_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for complement_groups
CREATE POLICY "Admins can manage complement groups" ON public.complement_groups
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view complement groups" ON public.complement_groups
  FOR SELECT USING (is_employee(auth.uid()));

-- RLS Policies for complement_options
CREATE POLICY "Admins can manage complement options" ON public.complement_options
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view complement options" ON public.complement_options
  FOR SELECT USING (is_employee(auth.uid()));

-- RLS Policies for complement_group_options
CREATE POLICY "Admins can manage group options" ON public.complement_group_options
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view group options" ON public.complement_group_options
  FOR SELECT USING (is_employee(auth.uid()));

-- RLS Policies for product_complement_groups
CREATE POLICY "Admins can manage product groups" ON public.product_complement_groups
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view product groups" ON public.product_complement_groups
  FOR SELECT USING (is_employee(auth.uid()));

-- Create triggers for updated_at
CREATE TRIGGER update_complement_groups_updated_at
  BEFORE UPDATE ON public.complement_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_complement_options_updated_at
  BEFORE UPDATE ON public.complement_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();