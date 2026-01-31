-- Enable realtime for profiles table to sync credit balance updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;