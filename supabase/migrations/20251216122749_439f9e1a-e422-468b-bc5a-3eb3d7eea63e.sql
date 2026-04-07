-- Enum para status de mesas
CREATE TYPE public.table_status AS ENUM ('available', 'occupied', 'reserved', 'bill_requested');

-- Enum para status de pedidos
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'delivered', 'cancelled');

-- Enum para tipo de pedido
CREATE TYPE public.order_type AS ENUM ('dine_in', 'takeaway', 'delivery');

-- Enum para formas de pagamento
CREATE TYPE public.payment_method AS ENUM ('cash', 'credit_card', 'debit_card', 'pix');

-- Enum para status do caixa
CREATE TYPE public.cash_register_status AS ENUM ('open', 'closed');

-- Enum para tipo de movimentação de estoque
CREATE TYPE public.stock_movement_type AS ENUM ('entry', 'exit', 'adjustment');

-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier', 'waiter', 'kitchen');

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'waiter',
  UNIQUE (user_id, role)
);

-- Tabela de categorias
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  preparation_time INTEGER DEFAULT 15, -- minutos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de variações de produtos (tamanhos, bordas, etc)
CREATE TABLE public.product_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- ex: "Pequena", "Média", "Grande"
  price_modifier DECIMAL(10, 2) DEFAULT 0, -- valor adicional
  is_active BOOLEAN DEFAULT TRUE
);

-- Tabela de adicionais
CREATE TABLE public.product_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de ingredientes (para estoque)
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL, -- kg, un, L, etc
  current_stock DECIMAL(10, 3) DEFAULT 0,
  min_stock DECIMAL(10, 3) DEFAULT 0,
  cost_per_unit DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ficha técnica (ingredientes por produto)
CREATE TABLE public.product_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  UNIQUE (product_id, ingredient_id)
);

-- Tabela de mesas
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  capacity INTEGER DEFAULT 4,
  status table_status DEFAULT 'available',
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  order_type order_type DEFAULT 'dine_in',
  status order_status DEFAULT 'pending',
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  subtotal DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Itens do pedido
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variation_id UUID REFERENCES public.product_variations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  status order_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionais dos itens
CREATE TABLE public.order_item_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE NOT NULL,
  extra_id UUID REFERENCES public.product_extras(id) ON DELETE SET NULL,
  extra_name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL
);

-- Movimentação de estoque
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
  movement_type stock_movement_type NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL,
  previous_stock DECIMAL(10, 3) NOT NULL,
  new_stock DECIMAL(10, 3) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Caixa
CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by UUID REFERENCES auth.users(id) NOT NULL,
  closed_by UUID REFERENCES auth.users(id),
  opening_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(10, 2),
  expected_amount DECIMAL(10, 2),
  difference DECIMAL(10, 2),
  status cash_register_status DEFAULT 'open',
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Pagamentos
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id),
  payment_method payment_method NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  received_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sangrias e suprimentos
CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('withdrawal', 'deposit')),
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- Function to check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is authenticated employee
CREATE OR REPLACE FUNCTION public.is_employee(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- RLS Policies

-- Profiles: users can read all, update own
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles: only admins can manage, employees can read own
CREATE POLICY "Employees can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Categories, Products, Variations, Extras: employees can read, admins can manage
CREATE POLICY "Employees can view categories" ON public.categories FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view products" ON public.products FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view variations" ON public.product_variations FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Admins can manage variations" ON public.product_variations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view extras" ON public.product_extras FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Admins can manage extras" ON public.product_extras FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Ingredients and stock
CREATE POLICY "Employees can view ingredients" ON public.ingredients FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Admins can manage ingredients" ON public.ingredients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view product ingredients" ON public.product_ingredients FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Admins can manage product ingredients" ON public.product_ingredients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Employees can create stock movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_employee(auth.uid()));

-- Tables: employees can manage
CREATE POLICY "Employees can view tables" ON public.tables FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Employees can manage tables" ON public.tables FOR ALL TO authenticated USING (public.is_employee(auth.uid()));

-- Orders and items: employees can manage
CREATE POLICY "Employees can view orders" ON public.orders FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Employees can manage orders" ON public.orders FOR ALL TO authenticated USING (public.is_employee(auth.uid()));

CREATE POLICY "Employees can view order items" ON public.order_items FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Employees can manage order items" ON public.order_items FOR ALL TO authenticated USING (public.is_employee(auth.uid()));

CREATE POLICY "Employees can view item extras" ON public.order_item_extras FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Employees can manage item extras" ON public.order_item_extras FOR ALL TO authenticated USING (public.is_employee(auth.uid()));

-- Cash register and payments: cashiers and admins
CREATE POLICY "Employees can view cash registers" ON public.cash_registers FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Cashiers can manage cash registers" ON public.cash_registers FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view payments" ON public.payments FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Cashiers can manage payments" ON public.payments FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view cash movements" ON public.cash_movements FOR SELECT TO authenticated USING (public.is_employee(auth.uid()));
CREATE POLICY "Cashiers can manage cash movements" ON public.cash_movements FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'admin'));

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'name', new.email));
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;