-- =============================================================================
-- GOAMAZE AI-POWERED PRODUCT ANALYSIS & RECOMMENDATION MIGRATION
-- =============================================================================
-- Run this script in your Supabase SQL Editor to add native columns for AI analysis.
-- Note: GoAmaze is built with 100% backward and forward compatibility: it securely
-- stores and reads AI attributes even before this migration is executed.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS "aiScore" NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "aiScoreBreakdown" JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "aiSummary" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "pros" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "cons" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "bestFor" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "recommendationReason" TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS "curationStatus" TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "confidenceLevel" TEXT DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS "dataQualityFlags" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "lastAnalyzedAt" TEXT DEFAULT '';

-- Performance indexes for sorting by AI score and curation status
CREATE INDEX IF NOT EXISTS idx_products_ai_score ON public.products("aiScore" DESC);
CREATE INDEX IF NOT EXISTS idx_products_curation_status ON public.products("curationStatus");
