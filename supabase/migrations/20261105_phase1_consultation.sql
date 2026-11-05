-- =============================================================================
-- Migration: Phase 1 - Doctor Presence & Live Consultation Requests
-- Created at: 2026-11-05
-- Description:
--   1. Ensures user_presence has proper indexes and RLS policies for online tracking.
--   2. Creates consultation_requests table with statuses (pending, accepted, rejected, expired, cancelled).
--   3. Sets up atomic constraints, indexes, and RLS policies for doctor and patient access.
--   4. Creates cleanup functions for stale presence heartbeats.
-- =============================================================================

-- 1. Ensure user_presence RLS and policies
ALTER TABLE IF EXISTS public.user_presence ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Policy: Anyone authenticated can read presence
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_presence' 
          AND policyname = 'Allow authenticated users to read presence'
    ) THEN
        CREATE POLICY "Allow authenticated users to read presence"
            ON public.user_presence
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    -- Policy: Users can insert their own presence
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_presence' 
          AND policyname = 'Allow users to insert own presence'
    ) THEN
        CREATE POLICY "Allow users to insert own presence"
            ON public.user_presence
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Policy: Users can update their own presence
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'user_presence' 
          AND policyname = 'Allow users to update own presence'
    ) THEN
        CREATE POLICY "Allow users to update own presence"
            ON public.user_presence
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Index on user_presence for fast online status lookups
CREATE INDEX IF NOT EXISTS idx_user_presence_online_last_seen 
    ON public.user_presence(is_online, last_seen DESC);

-- 2. Consultation Requests Table
CREATE TABLE IF NOT EXISTS public.consultation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    patient_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    room_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
);

-- Partial index to prevent a patient from having multiple active pending requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_patient_request
    ON public.consultation_requests(patient_id)
    WHERE (status = 'pending');

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_consultation_requests_doctor_status
    ON public.consultation_requests(doctor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_requests_patient_status
    ON public.consultation_requests(patient_id, status, created_at DESC);

-- 3. RLS for consultation_requests
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Patient can read their own consultation requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'consultation_requests' 
          AND policyname = 'Patients can read own consultation requests'
    ) THEN
        CREATE POLICY "Patients can read own consultation requests"
            ON public.consultation_requests
            FOR SELECT
            TO authenticated
            USING (auth.uid() = patient_id);
    END IF;

    -- Doctors can read requests assigned to them
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'consultation_requests' 
          AND policyname = 'Doctors can read assigned consultation requests'
    ) THEN
        CREATE POLICY "Doctors can read assigned consultation requests"
            ON public.consultation_requests
            FOR SELECT
            TO authenticated
            USING (auth.uid() = doctor_id);
    END IF;

    -- Patients can insert consultation requests where patient_id matches auth.uid()
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'consultation_requests' 
          AND policyname = 'Patients can create consultation requests'
    ) THEN
        CREATE POLICY "Patients can create consultation requests"
            ON public.consultation_requests
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = patient_id);
    END IF;

    -- Doctors can update status of requests assigned to them
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'consultation_requests' 
          AND policyname = 'Doctors can update assigned requests'
    ) THEN
        CREATE POLICY "Doctors can update assigned requests"
            ON public.consultation_requests
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = doctor_id);
    END IF;

    -- Patients can cancel their own pending requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'consultation_requests' 
          AND policyname = 'Patients can cancel pending requests'
    ) THEN
        CREATE POLICY "Patients can cancel pending requests"
            ON public.consultation_requests
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = patient_id AND status = 'pending')
            WITH CHECK (status = 'cancelled');
    END IF;
END $$;

-- 4. Enable Supabase Realtime publication on consultation_requests and video_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_requests;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_calls;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 5. Stale Presence Cleanup Function
CREATE OR REPLACE FUNCTION public.mark_stale_doctors_offline()
RETURNS void AS $$
BEGIN
    UPDATE public.user_presence
    SET is_online = false
    WHERE is_online = true
      AND last_seen < (now() - interval '90 seconds');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

