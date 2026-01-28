-- Fix RLS policies for app_settings to use PERMISSIVE instead of RESTRICTIVE
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can delete settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can view all settings" ON public.app_settings;

-- Create PERMISSIVE policies for admins
CREATE POLICY "Admins can view all settings" 
ON public.app_settings 
FOR SELECT 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert settings" 
ON public.app_settings 
FOR INSERT 
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update settings" 
ON public.app_settings 
FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete settings" 
ON public.app_settings 
FOR DELETE 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also add a policy for users to read credit costs (they need to see how much credits cost)
CREATE POLICY "Users can view credit costs" 
ON public.app_settings 
FOR SELECT 
TO authenticated
USING (key LIKE 'credit_cost_%');