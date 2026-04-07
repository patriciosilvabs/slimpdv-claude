-- Create global settings table for app-wide configurations
CREATE TABLE public.global_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Employees can view global settings
CREATE POLICY "Employees can view global settings"
ON public.global_settings
FOR SELECT
USING (is_employee(auth.uid()));

-- Admins can manage global settings
CREATE POLICY "Admins can manage global settings"
ON public.global_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default value for use_print_queue
INSERT INTO public.global_settings (key, value) VALUES ('use_print_queue', 'false');

-- Add trigger for updated_at
CREATE TRIGGER update_global_settings_updated_at
BEFORE UPDATE ON public.global_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();