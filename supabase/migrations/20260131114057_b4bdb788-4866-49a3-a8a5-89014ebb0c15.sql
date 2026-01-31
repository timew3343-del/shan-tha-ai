-- Fix the overly permissive RLS policy for credit_audit_log
DROP POLICY IF EXISTS "System can insert credit audit logs" ON public.credit_audit_log;

-- Create a more restrictive policy - only authenticated users can insert their own logs
CREATE POLICY "Authenticated users can insert own audit logs" ON public.credit_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Add policy for admins to insert audit logs (for admin actions)
CREATE POLICY "Admins can insert any audit logs" ON public.credit_audit_log
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));