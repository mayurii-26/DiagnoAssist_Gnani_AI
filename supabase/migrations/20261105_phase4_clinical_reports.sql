-- =============================================================================
-- Migration: Phase 4 - AI Clinical Summary & Structured EMR Generation
-- Created at: 2026-11-05
-- Description:
--   1. Ensures patient_details table supports doctor_id, room_id, transcription_id, and status.
--   2. Enables Row Level Security (RLS) on patient_details.
--   3. Adds policies for doctors and patients to access their own clinical reports.
--   4. Adds indexes for fast lookup by patient_id, doctor_id, and room_id.
-- =============================================================================

-- Add columns if not already present
ALTER TABLE public.patient_details 
    ADD COLUMN IF NOT EXISTS doctor_id UUID,
    ADD COLUMN IF NOT EXISTS room_id TEXT,
    ADD COLUMN IF NOT EXISTS transcription_id UUID,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Enable RLS
ALTER TABLE public.patient_details ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Policy: Allow authenticated users to view patient_details where they are the patient or the attending doctor
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'patient_details' 
          AND policyname = 'Allow participants to read patient_details'
    ) THEN
        CREATE POLICY "Allow participants to read patient_details"
            ON public.patient_details
            FOR SELECT
            TO authenticated
            USING (
                auth.uid() = patient_id 
                OR auth.uid() = doctor_id
                OR EXISTS (
                    SELECT 1 FROM public.transcriptions t
                    WHERE t.id = patient_details.transcription_id
                      AND (t.doctor_id = auth.uid() OR t.patient_id = auth.uid())
                )
            );
    END IF;

    -- Policy: Allow authenticated doctors and patients to insert clinical records
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'patient_details' 
          AND policyname = 'Allow participants to insert patient_details'
    ) THEN
        CREATE POLICY "Allow participants to insert patient_details"
            ON public.patient_details
            FOR INSERT
            TO authenticated
            WITH CHECK (
                auth.uid() = patient_id 
                OR auth.uid() = doctor_id
            );
    END IF;

    -- Policy: Allow attending doctor to update clinical reports (e.g. edit draft & approve)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'patient_details' 
          AND policyname = 'Allow doctors to update patient_details'
    ) THEN
        CREATE POLICY "Allow doctors to update patient_details"
            ON public.patient_details
            FOR UPDATE
            TO authenticated
            USING (
                auth.uid() = doctor_id
                OR auth.uid() = patient_id
            );
    END IF;
END $$;

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_patient_details_patient_id ON public.patient_details(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_details_doctor_id ON public.patient_details(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_details_room_id ON public.patient_details(room_id);

