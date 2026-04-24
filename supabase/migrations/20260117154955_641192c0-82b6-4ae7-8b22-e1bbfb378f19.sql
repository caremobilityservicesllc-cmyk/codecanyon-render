-- Add language_preference column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'es', 'fr', 'de', 'pt', 'it', 'nl'));