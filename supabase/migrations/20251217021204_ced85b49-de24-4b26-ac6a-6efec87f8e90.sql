-- Create print_sectors table
CREATE TABLE public.print_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  printer_name TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  icon TEXT DEFAULT 'Flame',
  color TEXT DEFAULT '#EF4444',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.print_sectors ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage print sectors" ON public.print_sectors
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Employees can view print sectors" ON public.print_sectors
  FOR SELECT USING (is_employee(auth.uid()));

-- Add print_sector_id to products
ALTER TABLE public.products ADD COLUMN print_sector_id UUID REFERENCES public.print_sectors(id);

-- Insert default sectors
INSERT INTO public.print_sectors (name, description, icon, color, sort_order) VALUES
  ('Cozinha', 'Pizzas, massas e pratos principais', 'ChefHat', '#EF4444', 1),
  ('Churrasqueira', 'Carnes grelhadas e espetos', 'Flame', '#F97316', 2),
  ('Chapa', 'Hambúrgueres e lanches', 'UtensilsCrossed', '#EAB308', 3),
  ('Bar', 'Bebidas e drinks', 'Beer', '#3B82F6', 4);