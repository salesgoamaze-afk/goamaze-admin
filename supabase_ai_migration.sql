-- =============================================================================
-- GOAMAZE AI-POWERED PRODUCT ANALYSIS, MULTI-SOURCE & DEDUPLICATION MIGRATION
-- =============================================================================
-- Run this script in your Supabase SQL Editor.
-- Note: GoAmaze is built with 100% backward and forward compatibility: it securely
-- stores and reads source and AI attributes even before this migration is executed.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'amazon',
  ADD COLUMN IF NOT EXISTS "aiScore" NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "aiScoreBreakdown" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "aiSummary" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "pros" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "cons" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "bestFor" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "recommendationReason" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "curationStatus" TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "confidenceLevel" TEXT DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS "dataQualityFlags" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "lastAnalyzedAt" TEXT DEFAULT '';

-- Populate default source for existing rows
UPDATE public.products SET "source" = 'amazon' WHERE "source" IS NULL;

-- Performance indexes for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_products_source ON public.products("source");
CREATE INDEX IF NOT EXISTS idx_products_ai_score ON public.products("aiScore" DESC);
CREATE INDEX IF NOT EXISTS idx_products_curation_status ON public.products("curationStatus");
