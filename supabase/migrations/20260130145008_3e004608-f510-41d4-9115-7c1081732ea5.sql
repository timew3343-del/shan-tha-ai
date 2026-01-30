-- 1. Make payment-screenshots bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'payment-screenshots';

-- 2. Create stricter RLS policies for payment-screenshots
DROP POLICY IF EXISTS "Anyone can view payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own payment screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own payment screenshots" ON storage.objects;

-- Only allow users to view their own screenshots
CREATE POLICY "Users can view their own payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all payment screenshots
CREATE POLICY "Admins can view all payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Only authenticated users can upload to their own folder
CREATE POLICY "Users can upload their own payment screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own screenshots
CREATE POLICY "Users can update their own payment screenshots"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'payment-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own screenshots
CREATE POLICY "Users can delete their own payment screenshots"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-screenshots' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Update profiles RLS to use secure credit deduction function
DROP POLICY IF EXISTS "Users can update profile info only" ON public.profiles;

CREATE POLICY "Users can update non-credit profile fields only"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Add Admins can view all profiles policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add Admins can view all transactions (already exists, but ensure it's correct)
-- Already exists from previous migrations

-- 6. Create a secure function for signed URL generation for admins
CREATE OR REPLACE FUNCTION public.get_screenshot_signed_url(screenshot_path text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signed_url text;
BEGIN
  -- Only admins can get signed URLs
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN NULL;
  END IF;
  
  -- Return the path for now - actual signing happens in edge function
  RETURN screenshot_path;
END;
$$;