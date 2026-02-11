-- Add unique constraint on referral_codes.user_id to prevent duplicates
ALTER TABLE public.referral_codes ADD CONSTRAINT referral_codes_user_id_unique UNIQUE (user_id);