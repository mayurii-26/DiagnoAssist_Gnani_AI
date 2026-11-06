-- =============================================================================
-- Migration: Clinical Translations Caching Table
-- Created at: 2026-11-06
-- Description:
--   Stores and caches translations of clinical encounter reports and transcripts
--   to avoid unnecessary re-translation and latency.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.clinical_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL CHECK (source_type IN ('clinical_report', 'transcript')),
    source_id TEXT NOT NULL,
    original_language TEXT NOT NULL DEFAULT 'en',
    target_language TEXT NOT NULL,
    translated_content JSONB NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gnani_vachana',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_type, source_id, target_language)
);

ALTER TABLE public.clinical_translations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'clinical_translations' 
          AND policyname = 'Allow authenticated read translations'
    ) THEN
        CREATE POLICY "Allow authenticated read translations"
            ON public.clinical_translations FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'clinical_translations' 
          AND policyname = 'Allow authenticated insert translations'
    ) THEN
        CREATE POLICY "Allow authenticated insert translations"
            ON public.clinical_translations FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinical_translations_lookup 
    ON public.clinical_translations(source_type, source_id, target_language);

