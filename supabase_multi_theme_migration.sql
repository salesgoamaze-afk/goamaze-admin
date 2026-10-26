-- =============================================================================
-- GOAMAZE MULTI-THEME, MULTI-CATEGORY & AI CLASSIFICATION SCHEMA MIGRATION
-- =============================================================================
-- Enables many-to-many product-category and product-theme relationships,
-- structured AI analysis versioning, seasonal collections, and reliable deduplication.
-- 100% backward and forward compatible with existing GoAmaze store and admin code.
-- =============================================================================

-- 1. THEMES TABLE (Lifestyle themes)
CREATE TABLE IF NOT EXISTS public.themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '✨',
    image TEXT DEFAULT '',
    "displayOrder" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 2. AUGMENT CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT '🏷️',
    slug TEXT NOT NULL UNIQUE,
    "createdAt" TEXT NOT NULL
);

ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "updatedAt" TEXT DEFAULT '';

-- 3. PRODUCT CATEGORIES MAPPING TABLE (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.product_categories (
    id TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    "categoryId" TEXT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'ai', -- 'ai', 'manual', 'api'
    "confidenceScore" NUMERIC DEFAULT 1.0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT uq_product_category UNIQUE ("productId", "categoryId")
);

-- 4. PRODUCT THEMES MAPPING TABLE (Many-to-Many)
CREATE TABLE IF NOT EXISTS public.product_themes (
    id TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    "themeId" TEXT NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'ai', -- 'ai', 'manual', 'api'
    "confidenceScore" NUMERIC DEFAULT 1.0,
    "reviewStatus" TEXT NOT NULL DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT uq_product_theme UNIQUE ("productId", "themeId")
);

-- 5. AI PRODUCT ANALYSES TABLE (Versioned AI analysis & classifications)
CREATE TABLE IF NOT EXISTS public.ai_product_analyses (
    id TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'gemini', -- 'gemini', 'groq', 'heuristic'
    model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "shortSummary" TEXT DEFAULT '',
    "keyFeatures" JSONB DEFAULT '[]'::jsonb,
    pros JSONB DEFAULT '[]'::jsonb,
    cons JSONB DEFAULT '[]'::jsonb,
    "bestFor" TEXT DEFAULT '',
    "comparisonAttributes" JSONB DEFAULT '{}'::jsonb,
    "recommendationExplanation" TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'DISCOVERED', 'PENDING_ANALYSIS', 'ANALYZING', 'ANALYZED', 'NEEDS_REVIEW', 'FAILED'
    "dataFingerprint" TEXT DEFAULT '',
    "errorMessage" TEXT DEFAULT '',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- 6. COLLECTIONS TABLE (Seasonal Campaigns, e.g. Diwali)
CREATE TABLE IF NOT EXISTS public.collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    banner TEXT DEFAULT '',
    "startDate" TEXT DEFAULT '',
    "endDate" TEXT DEFAULT '',
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TEXT NOT NULL
);

-- 7. PRODUCT COLLECTIONS MAPPING TABLE
CREATE TABLE IF NOT EXISTS public.product_collections (
    id TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    "collectionId" TEXT NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT uq_product_collection UNIQUE ("productId", "collectionId")
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_prod_cat_product ON public.product_categories("productId");
CREATE INDEX IF NOT EXISTS idx_prod_cat_category ON public.product_categories("categoryId");
CREATE INDEX IF NOT EXISTS idx_prod_cat_review ON public.product_categories("reviewStatus");

CREATE INDEX IF NOT EXISTS idx_prod_theme_product ON public.product_themes("productId");
CREATE INDEX IF NOT EXISTS idx_prod_theme_theme ON public.product_themes("themeId");
CREATE INDEX IF NOT EXISTS idx_prod_theme_review ON public.product_themes("reviewStatus");

CREATE INDEX IF NOT EXISTS idx_ai_analysis_product ON public.ai_product_analyses("productId");
CREATE INDEX IF NOT EXISTS idx_ai_analysis_status ON public.ai_product_analyses(status);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_fingerprint ON public.ai_product_analyses("dataFingerprint");

CREATE INDEX IF NOT EXISTS idx_themes_slug ON public.themes(slug);
CREATE INDEX IF NOT EXISTS idx_themes_active ON public.themes("isActive");
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON public.collections(slug);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_product_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

-- Themes RLS
DROP POLICY IF EXISTS "Public can view active themes" ON public.themes;
CREATE POLICY "Public can view active themes" ON public.themes FOR SELECT USING ("isActive" = true);
DROP POLICY IF EXISTS "Service role can manage themes" ON public.themes;
CREATE POLICY "Service role can manage themes" ON public.themes FOR ALL USING (true);

-- Product Categories RLS
DROP POLICY IF EXISTS "Public can view product categories" ON public.product_categories;
CREATE POLICY "Public can view product categories" ON public.product_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role can manage product categories" ON public.product_categories;
CREATE POLICY "Service role can manage product categories" ON public.product_categories FOR ALL USING (true);

-- Product Themes RLS
DROP POLICY IF EXISTS "Public can view product themes" ON public.product_themes;
CREATE POLICY "Public can view product themes" ON public.product_themes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role can manage product themes" ON public.product_themes;
CREATE POLICY "Service role can manage product themes" ON public.product_themes FOR ALL USING (true);

-- AI Analyses RLS
DROP POLICY IF EXISTS "Public can view approved ai analyses" ON public.ai_product_analyses;
CREATE POLICY "Public can view approved ai analyses" ON public.ai_product_analyses FOR SELECT USING (status = 'ANALYZED');
DROP POLICY IF EXISTS "Service role can manage ai analyses" ON public.ai_product_analyses;
CREATE POLICY "Service role can manage ai analyses" ON public.ai_product_analyses FOR ALL USING (true);

-- Collections RLS
DROP POLICY IF EXISTS "Public can view active collections" ON public.collections;
CREATE POLICY "Public can view active collections" ON public.collections FOR SELECT USING ("isActive" = true);
DROP POLICY IF EXISTS "Service role can manage collections" ON public.collections;
CREATE POLICY "Service role can manage collections" ON public.collections FOR ALL USING (true);

-- Product Collections RLS
DROP POLICY IF EXISTS "Public can view product collections" ON public.product_collections;
CREATE POLICY "Public can view product collections" ON public.product_collections FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role can manage product collections" ON public.product_collections;
CREATE POLICY "Service role can manage product collections" ON public.product_collections FOR ALL USING (true);

-- =============================================================================
-- SEED TAXONOMY: 3 PRIMARY LIFESTYLE THEMES
-- =============================================================================
INSERT INTO public.themes (id, name, slug, description, icon, image, "displayOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (
    'theme_smart_living',
    'Smart Living',
    'smart-living',
    'Products that make homes more comfortable, organized, attractive, and functional.',
    '🛋️',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
    1,
    TRUE,
    timezone('utc'::text, now())::text,
    timezone('utc'::text, now())::text
  ),
  (
    'theme_work_study_gaming',
    'Work, Study & Gaming',
    'work-study-gaming',
    'Products for productive workspaces, learning environments, computer setups, and gaming.',
    '🖥️',
    'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&q=80',
    2,
    TRUE,
    timezone('utc'::text, now())::text,
    timezone('utc'::text, now())::text
  ),
  (
    'theme_kitchen_everyday_essentials',
    'Kitchen & Everyday Essentials',
    'kitchen-everyday-essentials',
    'Products that make cooking, kitchen organization, beverages, and daily household tasks easier.',
    '🍳',
    'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80',
    3,
    TRUE,
    timezone('utc'::text, now())::text,
    timezone('utc'::text, now())::text
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  "displayOrder" = EXCLUDED."displayOrder",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = timezone('utc'::text, now())::text;

-- =============================================================================
-- SEED TAXONOMY: CANONICAL PRODUCT CATEGORIES
-- =============================================================================
INSERT INTO public.categories (id, name, slug, icon, description, "displayOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('cat_mobiles', 'Mobiles', 'mobiles', '📱', 'Smartphones and mobile devices', 1, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_mobile_accessories', 'Mobile Accessories', 'mobile-accessories', '🔌', 'Cases, chargers, cables, and phone mounts', 2, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_electronics', 'Electronics', 'electronics', '⚡', 'Consumer electronics and lifestyle tech', 3, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_audio_accessories', 'Audio Accessories', 'audio-accessories', '🎧', 'Headphones, earphones, speakers, and microphones', 4, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_computers', 'Computers', 'computers', '💻', 'Laptops, desktops, and computing devices', 5, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_computer_accessories', 'Computer Accessories', 'computer-accessories', '⌨️', 'Keyboards, mice, monitors, docks, and webcams', 6, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_smart_home', 'Smart Home', 'smart-home', '🏠', 'Smart lighting, smart plugs, hubs, and automation devices', 7, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_home_kitchen', 'Home & Kitchen', 'home-kitchen', '🏡', 'Home décor, organization, cookware, and furnishings', 8, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_kitchen_appliances', 'Kitchen Appliances', 'kitchen-appliances', '🍳', 'Air fryers, blenders, kettles, and food processors', 9, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_furniture', 'Furniture', 'furniture', '🪑', 'Ergonomic chairs, desks, stands, and tables', 10, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_lighting', 'Lighting', 'lighting', '💡', 'Desk lamps, ambient lights, strip lighting, and lanterns', 11, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_personal_care', 'Personal Care', 'personal-care', '🧴', 'Grooming, skincare, and wellness devices', 12, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_travel_accessories', 'Travel Accessories', 'travel-accessories', '🧳', 'Luggage, cable organizers, and travel essentials', 13, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_gifts', 'Gifts', 'gifts', '🎁', 'Curated gifts and festive hamper ideas', 14, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text),
  ('cat_sports_fitness', 'Sports & Fitness', 'sports-fitness', '🏋️', 'Fitness equipment and active gear', 15, TRUE, timezone('utc'::text, now())::text, timezone('utc'::text, now())::text)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = timezone('utc'::text, now())::text;

-- =============================================================================
-- SEED TAXONOMY: SEASONAL COLLECTIONS (DIWALI)
-- =============================================================================
INSERT INTO public.collections (id, name, slug, description, banner, "startDate", "endDate", "isActive", "createdAt")
VALUES
  (
    'col_diwali',
    'Festival Special - Diwali',
    'festival-special-diwali',
    'Handcrafted brass thalis, terracotta diyas & festive gift hampers',
    'https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f?w=800&q=80',
    '2026-10-01',
    '2026-11-30',
    TRUE,
    timezone('utc'::text, now())::text
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "isActive" = EXCLUDED."isActive";
