-- Run once in the Supabase SQL editor (after setup.sql). Safe to re-run.
-- 1. adds the `onboarded` flag the client's router guard reads
-- 2. creates a `profiles` row for every new user
-- 3. lets a signed-in user read/update only their own profile
-- Also recommended: Authentication > Sign In / Providers > turn OFF "Allow new users to sign up",
-- so accounts can only be created through POST /api/auth/register.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own profile" ON profiles;
CREATE POLICY "read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "update own profile" ON profiles;
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
