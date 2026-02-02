-- Add RLS policy to allow users to view their own credit audit logs
CREATE POLICY "Users can view their own credit audit logs"
ON public.credit_audit_log
FOR SELECT
USING (auth.uid() = user_id);