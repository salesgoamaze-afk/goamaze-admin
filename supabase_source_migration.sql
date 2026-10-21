-- =============================================================================
-- GOAMAZE MULTI-SOURCE & DEDUPLICATION MIGRATION
-- =============================================================================
-- Run this script in your Supabase SQL Editor:
-- Adds the 'source' column to the 'products' table (default 'amazon').
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'amazon';

-- Set default for existing records
UPDATE public.products
  SET "source" = 'amazon'
  WHERE "source" IS NULL;

-- Fast index for querying/filtering by source
CREATE INDEX IF NOT EXISTS idx_products_source ON public.products("source");
