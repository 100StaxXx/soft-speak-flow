-- Create trigger function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profile for existing user (2565b2ee-0238-4520-aff4-4ec881008faa)
INSERT INTO public.profiles (id, email, created_at, updated_at)
SELECT id, email, NOW(), NOW()
FROM auth.users
WHERE id = '2565b2ee-0238-4520-aff4-4ec881008faa'
ON CONFLICT (id) DO NOTHING;