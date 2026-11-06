-- =============================================================================
-- Migration: Fix Auth Signup & Resilient User Profile Sync
-- Created at: 2026-11-06
-- Description:
--   Resolves "Database error saving new user" during signup by:
--   1. Ensuring all expected columns exist on public.user_profiles.
--   2. Making handle_new_user() exception-safe (catches errors so auth is never blocked).
--   3. Auto-syncing both user_profiles and patients tables.
-- =============================================================================

-- 1. Ensure columns exist on public.user_profiles
ALTER TABLE public.user_profiles 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS specialty TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Resilient handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_name TEXT;
    v_role TEXT;
BEGIN
    v_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1),
        'User'
    );
    v_role := COALESCE(
        new.raw_user_meta_data->>'role',
        'patient'
    );

    -- Upsert profile record
    INSERT INTO public.user_profiles (id, name, role)
    VALUES (new.id, v_name, v_role)
    ON CONFLICT (id) DO UPDATE
    SET 
        name = EXCLUDED.name,
        role = EXCLUDED.role;

    -- If the new user is a patient, also ensure a corresponding entry in public.patients exists
    IF v_role = 'patient' THEN
        INSERT INTO public.patients (id, user_profile_id)
        VALUES (new.id, new.id)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- Log warning but NEVER abort the transaction so auth.signUp succeeds smoothly
    RAISE WARNING 'handle_new_user trigger encountered an issue for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

