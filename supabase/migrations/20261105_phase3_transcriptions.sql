-- =============================================================================
-- Migration: Phase 3 - Live Consultation Transcription & EMR Persistence
-- Created at: 2026-11-05
-- Description:
--   1. Enables RLS on transcriptions table.
--   2. Adds policies for doctors and patients to insert, select, and update their own transcripts.
--   3. Adds index for efficient room_id, doctor_id, and patient_id lookups.
-- =============================================================================

ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Policy: Allow doctors and patients to read their own transcripts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'transcriptions' 
          AND policyname = 'Allow participants to read transcriptions'
    ) THEN
        CREATE POLICY "Allow participants to read transcriptions"
            ON public.transcriptions
            FOR SELECT
            TO authenticated
            USING (auth.uid() = doctor_id OR auth.uid() = patient_id);
    END IF;

    -- Policy: Allow doctors and patients to insert transcriptions for their sessions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'transcriptions' 
          AND policyname = 'Allow participants to insert transcriptions'
    ) THEN
        CREATE POLICY "Allow participants to insert transcriptions"
            ON public.transcriptions
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = doctor_id OR auth.uid() = patient_id);
    END IF;

    -- Policy: Allow doctors and patients to update their transcripts
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'transcriptions' 
          AND policyname = 'Allow participants to update transcriptions'
    ) THEN
        CREATE POLICY "Allow participants to update transcriptions"
            ON public.transcriptions
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = doctor_id OR auth.uid() = patient_id);
    END IF;
END $$;

-- Indexes on transcriptions for fast participant and date queries
CREATE INDEX IF NOT EXISTS idx_transcriptions_doctor_id ON public.transcriptions(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcriptions_patient_id ON public.transcriptions(patient_id, created_at DESC);

