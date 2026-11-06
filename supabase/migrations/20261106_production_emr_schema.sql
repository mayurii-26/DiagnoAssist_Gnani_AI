-- =============================================================================
-- Migration: Production EMR & Consultation Schema for DiagnoAssist
-- Created at: 2026-11-06
-- Description:
--   1. Ensures user_profiles table with Auto-Sync Trigger from auth.users.
--   2. Creates consultation_requests table with statuses and indexes.
--   3. Enhances transcriptions table with room_id, language, and audio_url.
--   4. Upgrades patient_details with doctor_id, room_id, transcription_id, status, and approved_at.
--   5. Creates prescriptions table for structured medication extraction.
--   6. Enables Realtime publications for live consultation workflow.
-- =============================================================================

-- 1. Ensure User Profiles table with Auto-Sync Trigger from auth.users
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('doctor', 'patient', 'admin')),
    specialty TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS specialty TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT;

-- Auto-sync trigger from auth.users on signup
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

    INSERT INTO public.user_profiles (id, name, role)
    VALUES (new.id, v_name, v_role)
    ON CONFLICT (id) DO UPDATE
    SET 
        name = EXCLUDED.name,
        role = EXCLUDED.role;

    IF v_role = 'patient' THEN
        INSERT INTO public.patients (id, user_profile_id)
        VALUES (new.id, new.id)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user trigger encountered an issue for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Consultation Requests Table
CREATE TABLE IF NOT EXISTS public.consultation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    patient_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled')),
    room_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_consultation_requests_room_id ON public.consultation_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_consultation_requests_doctor_status ON public.consultation_requests(doctor_id, status);

-- 3. Enhance Transcriptions Table (add room_id & language)
ALTER TABLE public.transcriptions 
    ADD COLUMN IF NOT EXISTS room_id TEXT,
    ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en-IN',
    ADD COLUMN IF NOT EXISTS audio_url TEXT;

CREATE INDEX IF NOT EXISTS idx_transcriptions_room_id ON public.transcriptions(room_id);

-- 4. Upgrade patient_details to Full Clinical Encounter EMR
ALTER TABLE public.patient_details
    ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS room_id TEXT,
    ADD COLUMN IF NOT EXISTS transcription_id UUID,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_patient_details_doctor_id ON public.patient_details(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_details_room_id ON public.patient_details(room_id);
CREATE INDEX IF NOT EXISTS idx_patient_details_status ON public.patient_details(status);

-- 5. Structured Prescriptions Table (for extracted Rx items)
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinical_report_id UUID REFERENCES public.patient_details(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    medication_name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    duration TEXT,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Enable Realtime Publications for Live Video & Consultation Sync
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_calls;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_details;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

