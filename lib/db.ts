import bcrypt from "bcryptjs";
import productsJsonFallback from "@/data/products.json";
import { getSupabase } from "./supabase";
import {
  ProductSource,
  extractAsin,
  normalizeProductUrl,
  determineProductSource,
  findDuplicateInList,
  computeProductDataFingerprint,
  generateCanonicalProductId,
} from "./product-identifier";
import {
  PRIMARY_THEMES,
  ADMIN_THEMES,
  CANONICAL_CATEGORIES,
  SEASONAL_COLLECTIONS,
  getThemeBySlug as resolveThemeBySlug,
  getCategoryBySlug as resolveCategoryBySlug,
  mapLegacyCategoryToTaxonomy,
} from "./taxonomy";

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type AnalysisStatus =
  | "DISCOVERED"
  | "PENDING_ANALYSIS"
  | "ANALYZING"
  | "ANALYZED"
  | "NEEDS_REVIEW"
  | "FAILED";

export type AssignmentSource = "ai" | "manual" | "api";

export type ReviewStatus = "approved" | "pending" | "rejected";

export interface ProductCategoryMapping {
  id: string;
  productId: string;
  categoryId: string;
  categorySlug?: string;
  categoryName?: string;
  source: AssignmentSource;
  confidenceScore: number;
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export interface ProductThemeMapping {
  id: string;
  productId: string;
  themeId: string;
  themeSlug?: string;
  themeName?: string;
  source: AssignmentSource;
  confidenceScore: number;
  reviewStatus: ReviewStatus;
  createdAt: string;
}

export interface AIProductAnalysisRecord {
  id: string;
  productId: string;
  provider: string;
  model: string;
  promptVersion: string;
  shortSummary: string;
  keyFeatures: string[];
  pros: string[];
  cons: string[];
  bestFor: string;
  comparisonAttributes: Record<string, any>;
  recommendationExplanation: string;
  status: AnalysisStatus;
  dataFingerprint: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image: string;
  displayOrder: number;
  isActive: boolean;
  type?: "permanent" | "seasonal" | "miscellaneous";
  productTypes?: string[];
  defaultKeywords?: string[];
  createdAt: string;
  updatedAt: string;
  _id?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
  subcategories?: string[];
  amazonSearchIndex?: string;
  createdAt: string;
  updatedAt?: string;
  _id?: string;
}

export interface CollectionRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  banner: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  _id?: string;
}

export interface ProductRecord {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  originalPrice: string;
  unitPrice?: string;
  category: string; // Legacy / primary category for 100% backward compatibility
  categories: string[]; // Many-to-many category slugs
  themes: string[]; // Many-to-many lifestyle theme slugs
  collections?: string[]; // Seasonal collection slugs
  categoryMappings?: ProductCategoryMapping[];
  themeMappings?: ProductThemeMapping[];
  image: string;
  images?: string[];
  instagramUrl?: string;
  affiliateLink: string;
  badge: string;
  rating: number;
  reviews: number;
  featured: boolean | number;
  createdAt: string;
  updatedAt: string;
  _id?: string;
  source: ProductSource;

  // AI Recommendation attributes
  aiScore?: number;
  aiScoreBreakdown?: Record<string, number>;
  rank?: number;
  award?: string;
  aiSummary?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
  recommendationReason?: string;
  curationStatus?: "approved" | "pending" | "rejected" | string;
  confidenceLevel?: "high" | "medium" | "low" | string;
  dataQualityFlags?: string[];
  lastAnalyzedAt?: string;

  // AI Pipeline lifecycle
  analysisStatus: AnalysisStatus;
  dataFingerprint?: string;
  aiAnalysis?: Partial<AIProductAnalysisRecord>;
}

export type ProductInput = Omit<Partial<ProductRecord>, "featured"> & {
  featured?: boolean;
  source?: ProductSource;
  categories?: string[];
  themes?: string[];
  analysisStatus?: AnalysisStatus;
};

export interface CreateProductInput {
  id?: string;
  title: string;
  subtitle?: string;
  description?: string;
  price: string;
  originalPrice?: string;
  unitPrice?: string;
  category?: string;
  categories?: string[];
  themes?: string[];
  collections?: string[];
  image: string;
  images?: string[];
  instagramUrl?: string;
  affiliateLink: string;
  badge?: string;
  rating?: number | null;
  reviews?: number | null;
  featured?: boolean;
  source?: ProductSource;
  aiScore?: number | null;
  aiScoreBreakdown?: Record<string, number>;
  rank?: number;
  award?: string;
  aiSummary?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
  recommendationReason?: string;
  curationStatus?: string;
  confidenceLevel?: string;
  dataQualityFlags?: string[];
  lastAnalyzedAt?: string;
  analysisStatus?: AnalysisStatus;
  dataFingerprint?: string;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
  _id?: string;
}

export interface AdminOtpRecord {
  id: string;
  email: string;
  otp: string;
  attempts: number;
  expiresAt: number;
  createdAt: string;
}

export interface SubscriberRecord {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  _id?: string;
}

export interface BlogFAQ {
  question: string;
  answer: string;
}

export interface BlogRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author: string;
  readTime: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  aeoSummary?: string;
  geoTarget?: string;
  faqSchema?: BlogFAQ[];
  productIds?: string[];
  featured: boolean | number;
  published: boolean | number;
  createdAt: string;
  updatedAt: string;
  _id?: string;
}

export type BlogInput = Omit<Partial<BlogRecord>, "featured" | "published" | "keywords" | "faqSchema" | "productIds"> & {
  featured?: boolean;
  published?: boolean;
  keywords?: string[];
  faqSchema?: BlogFAQ[];
  productIds?: string[];
};

export interface CreateBlogInput {
  id?: string;
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author?: string;
  readTime?: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  aeoSummary?: string;
  geoTarget?: string;
  faqSchema?: BlogFAQ[];
  productIds?: string[];
  featured?: boolean;
  published?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTING & EMBEDDED METADATA HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatProduct(r: any): ProductRecord {
  let parsedImages: string[] = [];
  try {
    if (typeof r.images === "string" && r.images.trim()) {
      parsedImages = JSON.parse(r.images);
    } else if (Array.isArray(r.images)) {
      parsedImages = r.images;
    }
  } catch {
    parsedImages = [];
  }
  if (!parsedImages || parsedImages.length === 0) {
    parsedImages = r.image ? [r.image] : [];
  }

  // Parse embedded AI recommendation & multi-tax metadata if present in description
  let aiData: any = {};
  if (typeof r.description === "string" && r.description.includes("<!-- AI_DATA:")) {
    try {
      const match = r.description.match(/<!-- AI_DATA:\s*([\s\S]*?)\s*-->/);
      if (match && match[1]) {
        aiData = JSON.parse(match[1]);
      }
    } catch {
      aiData = {};
    }
  }

  // Clean description of internal AI tag for display
  const displayDescription = typeof r.description === "string"
    ? r.description.replace(/<!-- AI_DATA:[\s\S]*?-->/g, "").trim()
    : (r.description || "");

  // Determine multi-category assignments
  let categories: string[] = [];
  if (Array.isArray(r.categories) && r.categories.length > 0) {
    categories = r.categories;
  } else if (Array.isArray(aiData.categories) && aiData.categories.length > 0) {
    categories = aiData.categories;
  } else {
    const legacy = mapLegacyCategoryToTaxonomy(r.category, r.title);
    categories = legacy.categories;
  }

  // Determine multi-theme assignments
  let themes: string[] = [];
  if (Array.isArray(r.themes) && r.themes.length > 0) {
    themes = r.themes;
  } else if (Array.isArray(aiData.themes) && aiData.themes.length > 0) {
    themes = aiData.themes;
  } else {
    const legacy = mapLegacyCategoryToTaxonomy(r.category, r.title);
    themes = legacy.themes;
  }

  // Determine collections
  let collections: string[] = [];
  if (Array.isArray(r.collections)) {
    collections = r.collections;
  } else if (Array.isArray(aiData.collections)) {
    collections = aiData.collections;
  } else {
    const legacy = mapLegacyCategoryToTaxonomy(r.category, r.title);
    if (legacy.collections) collections = legacy.collections;
  }

  const analysisStatus: AnalysisStatus =
    r.analysisStatus ||
    aiData.analysisStatus ||
    (aiData.aiSummary || r.aiSummary ? "ANALYZED" : "PENDING_ANALYSIS");

  const dataFingerprint =
    r.dataFingerprint ||
    aiData.dataFingerprint ||
    computeProductDataFingerprint({
      title: r.title,
      features: aiData.features || [],
      description: displayDescription,
      brand: aiData.brand,
    });

  return {
    ...r,
    _id: String(r.id),
    id: String(r.id),
    description: displayDescription,
    category: r.category || categories[0] || "home-kitchen",
    categories,
    themes,
    collections,
    images: parsedImages,
    instagramUrl: r.instagramUrl || "",
    featured: Boolean(r.featured),
    rating: Number(r.rating ?? 4.5),
    reviews: Number(r.reviews ?? 0),
    source: r.source || aiData.source || determineProductSource({ affiliateLink: r.affiliateLink }) || "amazon",

    // AI Recommendation Structured Fields
    aiScore: r.aiScore !== undefined && r.aiScore !== null ? Number(r.aiScore) : aiData.aiScore,
    aiScoreBreakdown: r.aiScoreBreakdown || aiData.scoreBreakdown,
    rank: r.rank !== undefined && r.rank !== null ? Number(r.rank) : aiData.rank,
    award: r.award || aiData.award || (r.badge && r.badge.includes("Best") ? r.badge : undefined),
    aiSummary: r.aiSummary || aiData.aiSummary || "",
    pros: Array.isArray(r.pros) && r.pros.length > 0 ? r.pros : (aiData.pros || []),
    cons: Array.isArray(r.cons) && r.cons.length > 0 ? r.cons : (aiData.cons || []),
    bestFor: r.bestFor || aiData.bestFor || "",
    recommendationReason: r.recommendationReason || aiData.recommendationReason || "",
    curationStatus: r.curationStatus || aiData.curationStatus || "approved",
    confidenceLevel: r.confidenceLevel || aiData.confidenceLevel || "high",
    dataQualityFlags: Array.isArray(r.dataQualityFlags) ? r.dataQualityFlags : (aiData.dataQualityFlags || []),
    lastAnalyzedAt: r.lastAnalyzedAt || aiData.lastAnalyzedAt || "",

    // Lifecycle
    analysisStatus,
    dataFingerprint,
    categoryMappings: r.categoryMappings || [],
    themeMappings: r.themeMappings || [],
  };
}

function formatBlog(r: any): BlogRecord {
  let parsedKeywords: string[] = [];
  let parsedFaq: any[] = [];
  let parsedProducts: string[] = [];

  try {
    if (typeof r.keywords === "string" && r.keywords.trim()) parsedKeywords = JSON.parse(r.keywords);
    else if (Array.isArray(r.keywords)) parsedKeywords = r.keywords;
  } catch {}

  try {
    if (typeof r.faqSchema === "string" && r.faqSchema.trim()) parsedFaq = JSON.parse(r.faqSchema);
    else if (Array.isArray(r.faqSchema)) parsedFaq = r.faqSchema;
  } catch {}

  try {
    if (typeof r.productIds === "string" && r.productIds.trim()) parsedProducts = JSON.parse(r.productIds);
    else if (Array.isArray(r.productIds)) parsedProducts = r.productIds;
  } catch {}

  return {
    ...r,
    _id: String(r.id),
    id: String(r.id),
    keywords: parsedKeywords,
    faqSchema: parsedFaq,
    productIds: parsedProducts,
    featured: Boolean(r.featured),
    published: Boolean(r.published),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPOSITORY METHODS (Supabase Database Layer with Resilient Fallbacks)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductFilters {
  category?: string;
  theme?: string;
  collection?: string;
  search?: string;
  featured?: boolean;
  status?: AnalysisStatus | string;
  reviewStatus?: ReviewStatus | string;
  limit?: number;
  page?: number;
  sort?: "featured" | "rating" | "price-asc" | "price-desc" | "newest" | "aiScore";
}

export const db = {
  // ── THEMES ─────────────────────────────────────────────────────────────────
  async getThemes(): Promise<ThemeRecord[]> {
    const supabase = getSupabase();
    const adminThemeMap = new Map<string, ThemeRecord>();

    // 1. Preload all 5 Admin Themes (3 permanent lifestyle themes + seasonal diwali + misc)
    ADMIN_THEMES.forEach((t) => {
      adminThemeMap.set(t.slug.toLowerCase(), {
        ...t,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _id: t.id,
      });
    });

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("themes")
          .select("*")
          .order("displayOrder", { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          data.forEach((dbT: any) => {
            const cleanSlug = (dbT.slug || "").toLowerCase();
            const existing = adminThemeMap.get(cleanSlug);
            adminThemeMap.set(cleanSlug, {
              ...existing,
              ...dbT,
              type: existing?.type || (cleanSlug.includes("diwali") ? "seasonal" : cleanSlug.includes("misc") ? "miscellaneous" : "permanent"),
              productTypes: existing?.productTypes || dbT.productTypes || [],
              defaultKeywords: existing?.defaultKeywords || dbT.defaultKeywords || [],
              _id: dbT.id,
            });
          });
        }
      } catch (err: any) {
        console.warn("[db.getThemes] Fallback to admin themes:", err.message);
      }
    }

    return Array.from(adminThemeMap.values()).sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
  },

  async getThemeBySlug(slug: string): Promise<ThemeRecord | null> {
    const clean = slug.toLowerCase().trim();
    const themes = await this.getThemes();
    const found = themes.find((t) => t.slug.toLowerCase() === clean || t.id.toLowerCase() === clean);
    return found || null;
  },

  // ── CATEGORIES ─────────────────────────────────────────────────────────────
  async getCategories(): Promise<CategoryRecord[]> {
    const catMap = new Map<string, CategoryRecord>();

    // 1. Preload all canonical e-commerce categories with rich subcategories
    CANONICAL_CATEGORIES.forEach((c) => {
      catMap.set(c.slug.toLowerCase(), {
        ...c,
        createdAt: new Date().toISOString(),
        _id: c.id,
      });
      catMap.set(c.name.toLowerCase(), {
        ...c,
        createdAt: new Date().toISOString(),
        _id: c.id,
      });
    });

    // 2. Query Supabase and merge any custom database categories or overrides
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .order("name", { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          data.forEach((r: any) => {
            const slug = (r.slug || r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).toLowerCase();
            const canonical = catMap.get(slug) || catMap.get(r.name.toLowerCase());
            catMap.set(slug, {
              id: r.id || `cat_${slug}`,
              name: r.name,
              slug,
              icon: r.icon || canonical?.icon || "🏷️",
              description: r.description || canonical?.description || "",
              displayOrder: r.displayOrder || canonical?.displayOrder || 99,
              isActive: r.isActive !== false,
              subcategories: canonical?.subcategories || [],
              amazonSearchIndex: canonical?.amazonSearchIndex || "All",
              createdAt: r.createdAt || new Date().toISOString(),
              _id: r.id || `cat_${slug}`,
            });
          });
        }
      } catch (err: any) {
        console.warn("[db.getCategories] Fallback:", err.message);
      }
    }

    // Return unique categories sorted by displayOrder then name
    const unique = Array.from(new Set(Array.from(catMap.values()).map((c) => c.slug)))
      .map((slug) => catMap.get(slug)!)
      .sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99) || a.name.localeCompare(b.name));

    return unique;
  },

  async getCategoryById(id: string): Promise<CategoryRecord | null> {
    const categories = await this.getCategories();
    const clean = id.toLowerCase().trim();
    const found = categories.find((c) => c.id.toLowerCase() === clean || c.slug.toLowerCase() === clean || c.name.toLowerCase() === clean);
    return found || null;
  },

  async createCategory(name: string, icon = "🏷️", description = ""): Promise<CategoryRecord | null> {
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `cat-${Date.now()}`;
    const now = new Date().toISOString();

    const supabase = getSupabase();
    if (!supabase) {
      return { id, name: name.trim(), icon, slug, description, createdAt: now, _id: id };
    }

    const { data, error } = await supabase
      .from("categories")
      .upsert({ id, name: name.trim(), icon, slug, description, createdAt: now }, { onConflict: "slug" })
      .select()
      .single();

    if (error) {
      console.error("[Supabase createCategory error]", error);
      throw new Error(error.message);
    }
    return data ? { ...data, _id: data.id } : null;
  },

  async deleteCategory(id: string): Promise<CategoryRecord | null> {
    const cat = await this.getCategoryById(id);
    if (!cat) return null;

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from("categories").delete().eq("id", id);
    }
    return cat;
  },

  // ── COLLECTIONS ────────────────────────────────────────────────────────────
  async getCollections(): Promise<CollectionRecord[]> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from("collections").select("*").eq("isActive", true);
        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((c) => ({ ...c, _id: c.id }));
        }
      } catch (err: any) {
        console.warn("[db.getCollections] Fallback:", err.message);
      }
    }

    return SEASONAL_COLLECTIONS.map((c) => ({
      ...c,
      createdAt: new Date().toISOString(),
      _id: c.id,
    }));
  },

  // ── PRODUCTS (MULTI-THEME, MULTI-CATEGORY, DEDUPLICATED) ───────────────────
  async getProducts(filters?: ProductFilters): Promise<ProductRecord[]> {
    const supabase = getSupabase();

    if (supabase) {
      let query = supabase.from("products").select("*");

      // Handle category filter (canonical slug, name, or primary category)
      if (filters?.category && filters.category !== "All" && filters.category !== "all") {
        const catSlug = filters.category.toLowerCase().trim();
        // Check if product_categories mapping table is populated
        try {
          const { data: catMap } = await supabase
            .from("product_categories")
            .select("productId, categoryId, categories!inner(slug, name)")
            .or(`slug.eq.${catSlug},name.ilike.%${catSlug}%`, { foreignTable: "categories" });

          if (Array.isArray(catMap) && catMap.length > 0) {
            const productIds = Array.from(new Set(catMap.map((m: any) => m.productId)));
            query = query.in("id", productIds);
          } else {
            // Fallback to legacy string column or description search
            query = query.or(`category.ilike.%${filters.category}%,description.ilike.%${catSlug}%`);
          }
        } catch {
          query = query.or(`category.ilike.%${filters.category}%,description.ilike.%${catSlug}%`);
        }
      }

      // Handle theme filter
      if (filters?.theme && filters.theme !== "All" && filters.theme !== "all") {
        const themeSlug = filters.theme.toLowerCase().trim();
        try {
          const { data: themeMap } = await supabase
            .from("product_themes")
            .select("productId, themeId, themes!inner(slug, name)")
            .or(`slug.eq.${themeSlug},name.ilike.%${themeSlug}%`, { foreignTable: "themes" });

          if (Array.isArray(themeMap) && themeMap.length > 0) {
            const productIds = Array.from(new Set(themeMap.map((m: any) => m.productId)));
            query = query.in("id", productIds);
          } else {
            // Fallback: description embedded tag or keyword match
            query = query.ilike("description", `%${themeSlug}%`);
          }
        } catch {
          query = query.ilike("description", `%${themeSlug}%`);
        }
      }

      // Handle collection filter (e.g. festival-special-diwali)
      if (filters?.collection && filters.collection !== "All" && filters.collection !== "all") {
        const colSlug = filters.collection.toLowerCase().trim();
        try {
          const { data: colMap } = await supabase
            .from("product_collections")
            .select("productId, collectionId, collections!inner(slug)")
            .eq("collections.slug", colSlug);

          if (Array.isArray(colMap) && colMap.length > 0) {
            const productIds = Array.from(new Set(colMap.map((m: any) => m.productId)));
            query = query.in("id", productIds);
          } else {
            query = query.ilike("description", `%${colSlug}%`);
          }
        } catch {
          query = query.ilike("description", `%${colSlug}%`);
        }
      }

      if (filters?.featured !== undefined) {
        query = query.eq("featured", filters.featured);
      }

      if (filters?.search) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`title.ilike.${term},subtitle.ilike.${term},category.ilike.${term},badge.ilike.${term},description.ilike.${term}`);
      }

      // Sorting
      if (filters?.sort === "rating") {
        query = query.order("rating", { ascending: false }).order("reviews", { ascending: false });
      } else if (filters?.sort === "price-asc") {
        query = query.order("price", { ascending: true });
      } else if (filters?.sort === "price-desc") {
        query = query.order("price", { ascending: false });
      } else if (filters?.sort === "newest") {
        query = query.order("createdAt", { ascending: false });
      } else {
        query = query.order("featured", { ascending: false }).order("createdAt", { ascending: false });
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[Supabase getProducts error]", error);
        return [];
      }

      const formatted = (data || []).map(formatProduct);

      // Post-filter for theme/category if database table joins were not populated yet
      let results = formatted;
      if (filters?.theme && filters.theme !== "All" && filters.theme !== "all") {
        const cleanTheme = filters.theme.toLowerCase().trim();
        results = results.filter((p) => p.themes.includes(cleanTheme) || p.description.toLowerCase().includes(cleanTheme));
      }
      if (filters?.category && filters.category !== "All" && filters.category !== "all") {
        const cleanCat = filters.category.toLowerCase().trim();
        results = results.filter((p) => p.categories.includes(cleanCat) || p.category.toLowerCase().includes(cleanCat));
      }
      if (filters?.status && filters.status !== "all") {
        results = results.filter((p) => p.analysisStatus === filters.status);
      }

      return results;
    }

    // Static Fallback when Supabase is not configured
    let products = Array.isArray(productsJsonFallback) ? (productsJsonFallback as any[]).map(formatProduct) : [];

    if (filters?.theme && filters.theme !== "All" && filters.theme !== "all") {
      const cleanTheme = filters.theme.toLowerCase().trim();
      products = products.filter((p) => p.themes.includes(cleanTheme));
    }
    if (filters?.category && filters.category !== "All" && filters.category !== "all") {
      const cleanCat = filters.category.toLowerCase().trim();
      products = products.filter((p) => p.categories.includes(cleanCat) || p.category.toLowerCase() === cleanCat);
    }
    if (filters?.featured !== undefined) {
      products = products.filter((p) => Boolean(p.featured) === filters.featured);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      products = products.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.subtitle?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.categories?.some((c) => c.toLowerCase().includes(q)) ||
          p.themes?.some((t) => t.toLowerCase().includes(q)) ||
          p.badge?.toLowerCase().includes(q)
      );
    }
    if (filters?.status && filters.status !== "all") {
      products = products.filter((p) => p.analysisStatus === filters.status);
    }
    if (filters?.limit) {
      products = products.slice(0, filters.limit);
    }
    return products;
  },

  async getProductById(id: string | number): Promise<ProductRecord | null> {
    if (id === undefined || id === null || id === "") return null;
    const idStr = String(id).trim();

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", idStr)
        .maybeSingle();

      if (error) {
        console.error("[Supabase getProductById error]", error);
        return null;
      }
      if (!data) return null;

      const product = formatProduct(data);

      // Fetch many-to-many category & theme mappings from database tables if present
      try {
        const [catRes, themeRes] = await Promise.all([
          supabase.from("product_categories").select("*, categories(name, slug)").eq("productId", idStr),
          supabase.from("product_themes").select("*, themes(name, slug)").eq("productId", idStr),
        ]);

        if (Array.isArray(catRes.data) && catRes.data.length > 0) {
          product.categoryMappings = catRes.data.map((m: any) => ({
            id: m.id,
            productId: m.productId,
            categoryId: m.categoryId,
            categorySlug: m.categories?.slug,
            categoryName: m.categories?.name,
            source: m.source,
            confidenceScore: Number(m.confidenceScore || 1.0),
            reviewStatus: m.reviewStatus,
            createdAt: m.createdAt,
          }));
          product.categories = product.categoryMappings.map((m) => m.categorySlug || "").filter(Boolean);
        }

        if (Array.isArray(themeRes.data) && themeRes.data.length > 0) {
          product.themeMappings = themeRes.data.map((m: any) => ({
            id: m.id,
            productId: m.productId,
            themeId: m.themeId,
            themeSlug: m.themes?.slug,
            themeName: m.themes?.name,
            source: m.source,
            confidenceScore: Number(m.confidenceScore || 1.0),
            reviewStatus: m.reviewStatus,
            createdAt: m.createdAt,
          }));
          product.themes = product.themeMappings.map((m) => m.themeSlug || "").filter(Boolean);
        }
      } catch (err: any) {
        // Soft fallback to embedded description attributes
      }

      return product;
    }

    // Static Fallback
    const found = (productsJsonFallback as any[]).find((p) => String(p.id) === idStr);
    return found ? formatProduct(found) : null;
  },

  // ── CORE CANONICAL PRODUCT UPSERT SERVICE ─────────────────────────────────
  async upsertProduct(data: CreateProductInput, options?: { sourceRule?: AssignmentSource }): Promise<ProductRecord | null> {
    const supabase = getSupabase();
    const effectiveSource = determineProductSource(data);
    const now = new Date().toISOString();

    const asin = extractAsin(data.affiliateLink) || extractAsin(data.id);
    const canonicalId = asin ? generateCanonicalProductId(asin, effectiveSource) : (data.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    // 1. Resolve Categories & Themes (Auto-map legacy if not explicitly provided)
    let assignedCategories = Array.isArray(data.categories) && data.categories.length > 0
      ? data.categories
      : (data.category ? mapLegacyCategoryToTaxonomy(data.category, data.title).categories : ["home-kitchen"]);

    let assignedThemes = Array.isArray(data.themes)
      ? data.themes
      : (data.category ? mapLegacyCategoryToTaxonomy(data.category, data.title).themes : []);

    let assignedCollections = Array.isArray(data.collections)
      ? data.collections
      : (data.category ? mapLegacyCategoryToTaxonomy(data.category, data.title).collections || [] : []);

    // 2. Check for existing product in catalog (by ASIN, URL, or Title)
    const existingList = await this.getProducts({ limit: 5000 });
    const duplicate = findDuplicateInList(
      {
        id: canonicalId,
        title: data.title,
        category: data.category,
        affiliateLink: data.affiliateLink,
        source: effectiveSource,
      },
      existingList
    );

    // Compute data fingerprint
    const fingerprint = data.dataFingerprint || computeProductDataFingerprint({
      title: data.title,
      description: data.description,
      brand: data.unitPrice,
    });

    const primaryCategory = data.category || assignedCategories[0] || "home-kitchen";
    const imagesArray = Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.image ? [data.image] : []);
    const primaryImage = data.image || imagesArray[0] || "";

    // ── CASE A: Update existing canonical product ──────────────────────────
    if (duplicate) {
      console.log(`[db.upsertProduct] Updating canonical record for "${data.title}" (ID: ${duplicate.id}).`);

      // Preserve manually curated fields if the existing product had manual assignment
      const manualCategoryAssignments = duplicate.categoryMappings?.filter((m) => m.source === "manual") || [];
      const manualThemeAssignments = duplicate.themeMappings?.filter((m) => m.source === "manual") || [];

      if (manualCategoryAssignments.length > 0 && options?.sourceRule !== "manual") {
        assignedCategories = Array.from(new Set([...assignedCategories, ...manualCategoryAssignments.map((m) => m.categorySlug || "")]));
      }
      if (manualThemeAssignments.length > 0 && options?.sourceRule !== "manual") {
        assignedThemes = Array.from(new Set([...assignedThemes, ...manualThemeAssignments.map((m) => m.themeSlug || "")]));
      }

      // Preserve AI analysis if data fingerprint is identical
      const isUnchanged = duplicate.dataFingerprint === fingerprint;
      const effectiveStatus: AnalysisStatus = data.analysisStatus || (isUnchanged ? duplicate.analysisStatus : "PENDING_ANALYSIS");

      return await this.updateProduct(duplicate.id, {
        title: data.title,
        subtitle: data.subtitle || duplicate.subtitle,
        description: data.description || duplicate.description,
        price: data.price,
        originalPrice: data.originalPrice || duplicate.originalPrice,
        unitPrice: data.unitPrice || duplicate.unitPrice,
        category: primaryCategory,
        categories: assignedCategories,
        themes: assignedThemes,
        collections: assignedCollections,
        image: primaryImage || duplicate.image,
        images: imagesArray.length > 0 ? imagesArray : duplicate.images,
        affiliateLink: data.affiliateLink || duplicate.affiliateLink,
        badge: data.badge || duplicate.badge,
        rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : duplicate.rating,
        reviews: data.reviews !== undefined && data.reviews !== null ? Number(data.reviews) : duplicate.reviews,
        featured: Boolean(data.featured !== undefined ? data.featured : duplicate.featured),
        source: effectiveSource,
        analysisStatus: effectiveStatus,
        dataFingerprint: fingerprint,
        aiScore: data.aiScore !== undefined && data.aiScore !== null ? Number(data.aiScore) : duplicate.aiScore,
        aiScoreBreakdown: data.aiScoreBreakdown || duplicate.aiScoreBreakdown,
        rank: data.rank !== undefined ? Number(data.rank) : duplicate.rank,
        award: data.award || duplicate.award,
        aiSummary: data.aiSummary || duplicate.aiSummary,
        pros: data.pros && data.pros.length > 0 ? data.pros : duplicate.pros,
        cons: data.cons && data.cons.length > 0 ? data.cons : duplicate.cons,
        bestFor: data.bestFor || duplicate.bestFor,
        recommendationReason: data.recommendationReason || duplicate.recommendationReason,
        curationStatus: data.curationStatus || duplicate.curationStatus,
        confidenceLevel: data.confidenceLevel || duplicate.confidenceLevel,
        dataQualityFlags: data.dataQualityFlags || duplicate.dataQualityFlags,
        lastAnalyzedAt: data.lastAnalyzedAt || duplicate.lastAnalyzedAt,
      });
    }

    // ── CASE B: Insert new canonical product ───────────────────────────────
    if (!supabase) {
      return null;
    }

    // Embed structured multi-taxonomy metadata in description
    const aiMeta = {
      source: effectiveSource,
      categories: assignedCategories,
      themes: assignedThemes,
      collections: assignedCollections,
      analysisStatus: data.analysisStatus || "PENDING_ANALYSIS",
      dataFingerprint: fingerprint,
      aiScore: data.aiScore,
      scoreBreakdown: data.aiScoreBreakdown,
      rank: data.rank,
      award: data.award,
      aiSummary: data.aiSummary,
      pros: data.pros || [],
      cons: data.cons || [],
      bestFor: data.bestFor,
      recommendationReason: data.recommendationReason,
      confidenceLevel: data.confidenceLevel || "high",
      curationStatus: data.curationStatus || "approved",
      dataQualityFlags: data.dataQualityFlags || [],
      lastAnalyzedAt: data.lastAnalyzedAt || now,
    };

    let cleanDesc = (data.description || "").replace(/<!-- AI_DATA:[\s\S]*?-->/g, "").trim();
    const finalDescription = `${cleanDesc}\n\n<!-- AI_DATA: ${JSON.stringify(aiMeta)} -->`;

    const newRecord: any = {
      id: canonicalId,
      title: data.title,
      subtitle: data.subtitle || data.title,
      description: finalDescription,
      price: data.price,
      originalPrice: data.originalPrice || data.price,
      unitPrice: data.unitPrice || "",
      category: primaryCategory,
      image: primaryImage,
      images: imagesArray,
      instagramUrl: data.instagramUrl || "",
      affiliateLink: data.affiliateLink,
      badge: data.badge || "New",
      rating: data.rating !== undefined && data.rating !== null ? Number(data.rating) : 4.5,
      reviews: data.reviews !== undefined && data.reviews !== null ? Number(data.reviews) : 0,
      featured: Boolean(data.featured),
      createdAt: now,
      updatedAt: now,
    };

    const { data: created, error } = await supabase
      .from("products")
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error("[Supabase upsertProduct insert error]", error);
      throw new Error(error.message);
    }

    // Attempt to populate relational mapping tables if active in Supabase
    await this.syncProductMappings(canonicalId, assignedCategories, assignedThemes, options?.sourceRule || "api");

    return created ? formatProduct(created) : null;
  },

  // ── UPDATE PRODUCT ────────────────────────────────────────────────────────
  async updateProduct(id: string | number, data: ProductInput): Promise<ProductRecord | null> {
    const supabase = getSupabase();
    const idStr = String(id).trim();

    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const existingProduct = await this.getProductById(idStr);
    const now = new Date().toISOString();
    const updateData: any = { updatedAt: now };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.originalPrice !== undefined) updateData.originalPrice = data.originalPrice;
    if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.images !== undefined) {
      updateData.images = Array.isArray(data.images) ? data.images : [];
      if (data.image === undefined && updateData.images.length > 0) {
        updateData.image = updateData.images[0];
      }
    }
    if (data.instagramUrl !== undefined) updateData.instagramUrl = data.instagramUrl;
    if (data.affiliateLink !== undefined) updateData.affiliateLink = data.affiliateLink;
    if (data.badge !== undefined) updateData.badge = data.badge;
    if (data.rating !== undefined && data.rating !== null) updateData.rating = Number(data.rating);
    if (data.reviews !== undefined && data.reviews !== null) updateData.reviews = Number(data.reviews);
    if (data.featured !== undefined) updateData.featured = Boolean(data.featured);
    // Note: source is stored inside the embedded description metadata (aiMeta)
    // rather than direct column to match the active Supabase schema.

    // AI & Multi-Taxonomy metadata packaging
    const effectiveCategories = data.categories || existingProduct?.categories || [updateData.category || "home-kitchen"];
    const effectiveThemes = data.themes !== undefined ? data.themes : (existingProduct?.themes || []);
    const effectiveCollections = data.collections !== undefined ? data.collections : (existingProduct?.collections || []);
    const effectiveStatus = data.analysisStatus || existingProduct?.analysisStatus || "ANALYZED";
    const fingerprint = data.dataFingerprint || existingProduct?.dataFingerprint || computeProductDataFingerprint({
      title: data.title || existingProduct?.title || "",
      description: data.description || existingProduct?.description || "",
      brand: data.unitPrice || existingProduct?.unitPrice,
    });

    const cleanDesc = (data.description !== undefined ? data.description : existingProduct?.description || "")
      .replace(/<!-- AI_DATA:[\s\S]*?-->/g, "")
      .trim();

    const aiMeta = {
      source: data.source || existingProduct?.source || "amazon",
      categories: effectiveCategories,
      themes: effectiveThemes,
      collections: effectiveCollections,
      analysisStatus: effectiveStatus,
      dataFingerprint: fingerprint,
      aiScore: data.aiScore !== undefined ? data.aiScore : existingProduct?.aiScore,
      scoreBreakdown: data.aiScoreBreakdown || existingProduct?.aiScoreBreakdown,
      rank: data.rank !== undefined ? data.rank : existingProduct?.rank,
      award: data.award !== undefined ? data.award : existingProduct?.award,
      aiSummary: data.aiSummary !== undefined ? data.aiSummary : existingProduct?.aiSummary,
      pros: data.pros !== undefined ? data.pros : existingProduct?.pros,
      cons: data.cons !== undefined ? data.cons : existingProduct?.cons,
      bestFor: data.bestFor !== undefined ? data.bestFor : existingProduct?.bestFor,
      recommendationReason: data.recommendationReason !== undefined ? data.recommendationReason : existingProduct?.recommendationReason,
      confidenceLevel: data.confidenceLevel || existingProduct?.confidenceLevel || "high",
      curationStatus: data.curationStatus || existingProduct?.curationStatus || "approved",
      dataQualityFlags: data.dataQualityFlags || existingProduct?.dataQualityFlags || [],
      lastAnalyzedAt: data.lastAnalyzedAt || now,
    };
    updateData.description = `${cleanDesc}\n\n<!-- AI_DATA: ${JSON.stringify(aiMeta)} -->`;

    let { data: updated, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", idStr)
      .select()
      .maybeSingle();

    if (error && error.message.includes("source")) {
      delete updateData.source;
      const res = await supabase.from("products").update(updateData).eq("id", idStr).select().maybeSingle();
      if (res.error) throw new Error(res.error.message);
      updated = res.data;
    } else if (error) {
      throw new Error(error.message);
    }

    // Sync relational mapping tables
    await this.syncProductMappings(idStr, effectiveCategories, effectiveThemes, "manual");

    return updated ? formatProduct(updated) : null;
  },

  // ── SYNCHRONIZE PRODUCT MAPPINGS (MAPPING TABLES) ─────────────────────────
  async syncProductMappings(
    productId: string,
    categories: string[],
    themes: string[],
    source: AssignmentSource = "ai"
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;

    const now = new Date().toISOString();

    // 1. Sync Product Categories
    try {
      const allCats = await this.getCategories();
      const validCategoryIds: string[] = [];

      for (const catSlug of categories) {
        const found = allCats.find((c) => c.slug.toLowerCase() === catSlug.toLowerCase() || c.name.toLowerCase() === catSlug.toLowerCase());
        if (found) validCategoryIds.push(found.id);
      }

      if (validCategoryIds.length > 0) {
        const catRows = validCategoryIds.map((catId) => ({
          id: `pc_${productId}_${catId}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60),
          productId,
          categoryId: catId,
          source,
          confidenceScore: 0.95,
          reviewStatus: "approved",
          createdAt: now,
          updatedAt: now,
        }));
        await supabase.from("product_categories").upsert(catRows, { onConflict: "productId,categoryId" });
      }
    } catch {
      // Ignored if table not created yet in SQL editor
    }

    // 2. Sync Product Themes
    try {
      const allThemes = await this.getThemes();
      const validThemeIds: string[] = [];

      for (const themeSlug of themes) {
        const found = allThemes.find((t) => t.slug.toLowerCase() === themeSlug.toLowerCase() || t.id.toLowerCase() === themeSlug.toLowerCase());
        if (found) validThemeIds.push(found.id);
      }

      if (validThemeIds.length > 0) {
        const themeRows = validThemeIds.map((thId) => ({
          id: `pt_${productId}_${thId}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 60),
          productId,
          themeId: thId,
          source,
          confidenceScore: 0.95,
          reviewStatus: "approved",
          createdAt: now,
          updatedAt: now,
        }));
        await supabase.from("product_themes").upsert(themeRows, { onConflict: "productId,themeId" });
      }
    } catch {
      // Ignored if table not created yet in SQL editor
    }
  },

  // ── SAVE AI ANALYSIS & CLASSIFICATIONS ────────────────────────────────────
  async saveAIAnalysis(
    productId: string,
    analysis: {
      provider: string;
      model: string;
      promptVersion: string;
      shortSummary: string;
      keyFeatures?: string[];
      pros?: string[];
      cons?: string[];
      bestFor?: string;
      comparisonAttributes?: Record<string, any>;
      recommendationExplanation?: string;
      categories: Array<{ slug: string; confidence: number }>;
      themes: Array<{ slug: string; confidence: number }>;
      status?: AnalysisStatus;
      dataFingerprint?: string;
      overallScore?: number;
      rank?: number;
      award?: string;
    }
  ): Promise<ProductRecord | null> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const categorySlugs = analysis.categories.map((c) => c.slug);
    const themeSlugs = analysis.themes.map((t) => t.slug);
    const finalStatus = analysis.status || "ANALYZED";

    // 1. Try to record in ai_product_analyses audit table
    if (supabase) {
      try {
        const analysisId = `aia_${productId}_${Date.now()}`;
        await supabase.from("ai_product_analyses").insert({
          id: analysisId,
          productId,
          provider: analysis.provider,
          model: analysis.model,
          promptVersion: analysis.promptVersion,
          shortSummary: analysis.shortSummary,
          keyFeatures: analysis.keyFeatures || [],
          pros: analysis.pros || [],
          cons: analysis.cons || [],
          bestFor: analysis.bestFor || "",
          comparisonAttributes: analysis.comparisonAttributes || {},
          recommendationExplanation: analysis.recommendationExplanation || "",
          status: finalStatus,
          dataFingerprint: analysis.dataFingerprint || "",
          createdAt: now,
          updatedAt: now,
        });
      } catch {
        // Ignored if table not created yet in SQL editor
      }
    }

    // 2. Update canonical product with fresh AI attributes and mappings
    return await this.updateProduct(productId, {
      categories: categorySlugs,
      themes: themeSlugs,
      aiSummary: analysis.shortSummary,
      bestFor: analysis.bestFor,
      recommendationReason: analysis.recommendationExplanation,
      pros: analysis.pros,
      cons: analysis.cons,
      aiScore: analysis.overallScore,
      rank: analysis.rank,
      award: analysis.award,
      analysisStatus: finalStatus,
      dataFingerprint: analysis.dataFingerprint,
      lastAnalyzedAt: now,
    });
  },

  // ── PENDING AI ANALYSIS QUEUE ─────────────────────────────────────────────
  async getPendingAnalysisProducts(limit = 20): Promise<ProductRecord[]> {
    const all = await this.getProducts({ limit: 500 });
    return all.filter((p) => p.analysisStatus === "PENDING_ANALYSIS" || p.analysisStatus === "DISCOVERED").slice(0, limit);
  },

  async updateAnalysisStatus(productId: string, status: AnalysisStatus, errorMessage?: string): Promise<ProductRecord | null> {
    return await this.updateProduct(productId, {
      analysisStatus: status,
      ...(errorMessage ? { badge: `Err: ${errorMessage.slice(0, 30)}` } : {}),
    });
  },

  async createProduct(data: CreateProductInput): Promise<ProductRecord | null> {
    return await this.upsertProduct(data, { sourceRule: "api" });
  },

  async deleteProduct(id: string | number): Promise<ProductRecord | null> {
    const product = await this.getProductById(id);
    if (!product) return null;

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      console.error("[Supabase deleteProduct error]", error);
      throw new Error(error.message);
    }
    return product;
  },

  async createProductsBatch(records: CreateProductInput[]): Promise<{ added: ProductRecord[]; updated: ProductRecord[]; count: number }> {
    if (!records || records.length === 0) return { added: [], updated: [], count: 0 };
    const added: ProductRecord[] = [];
    const updated: ProductRecord[] = [];

    for (const item of records) {
      const up = await this.upsertProduct(item);
      if (up) {
        added.push(up);
      }
    }

    return { added, updated, count: added.length };
  },

  async checkExistingAsins(asins: string[]): Promise<string[]> {
    if (!asins || asins.length === 0) return [];
    const allProducts = await this.getProducts({ limit: 5000 });
    const existingAsinSet = new Set<string>();

    for (const p of allProducts) {
      const asin = extractAsin(p.affiliateLink) || extractAsin(p.id);
      if (asin) existingAsinSet.add(asin.toUpperCase());
    }

    const found: string[] = [];
    for (const candidate of asins) {
      const clean = extractAsin(candidate) || candidate.trim().toUpperCase();
      if (existingAsinSet.has(clean)) {
        found.push(clean);
      }
    }
    return found;
  },

  // ── ADMIN USERS ───────────────────────────────────────────────────────────
  async getAdminByEmail(email: string): Promise<(AdminUserRecord & { comparePassword(c: string): boolean }) | null> {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabase();

    if (supabase) {
      let { data: row } = await supabase.from("admins").select("*").eq("email", cleanEmail).maybeSingle();
      if (!row) {
        const authorizedEmails = [
          "salesgoamaze@gmail.com",
          "admin@goamaze.com",
          ...(process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.split(",").map((e) => e.trim().toLowerCase()) : []),
        ];
        if (authorizedEmails.includes(cleanEmail)) {
          const id = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const defaultPassword = process.env.ADMIN_PASSWORD || "GoAmaze@2024!";
          const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
          const now = new Date().toISOString();
          const { data: inserted } = await supabase.from("admins").insert({
            id,
            name: process.env.ADMIN_NAME || "GoAmaze Admin",
            email: cleanEmail,
            password: hashedPassword,
            role: "superadmin",
            createdAt: now,
          }).select().single();
          row = inserted;
        }
      }
      if (!row) return null;
      return {
        ...row,
        _id: row.id,
        comparePassword(candidate: string) {
          return bcrypt.compareSync(candidate, row.password);
        },
      };
    }

    const authorizedEmails = [
      "salesgoamaze@gmail.com",
      "admin@goamaze.com",
      ...(process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.split(",").map((e) => e.trim().toLowerCase()) : []),
    ];
    if (authorizedEmails.includes(cleanEmail)) {
      const defaultPassword = process.env.ADMIN_PASSWORD || "GoAmaze@2024!";
      const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
      return {
        id: "admin_default",
        _id: "admin_default",
        name: process.env.ADMIN_NAME || "GoAmaze Admin",
        email: cleanEmail,
        password: hashedPassword,
        role: "superadmin",
        createdAt: new Date().toISOString(),
        comparePassword(candidate: string) {
          return bcrypt.compareSync(candidate, hashedPassword);
        },
      };
    }

    return null;
  },

  async createAdmin(name: string, email: string, passwordPlain: string, role = "admin") {
    const id = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hashedPassword = bcrypt.hashSync(passwordPlain, 10);
    const now = new Date().toISOString();
    const cleanEmail = email.toLowerCase().trim();

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    await supabase.from("admins").insert({
      id,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role,
      createdAt: now,
    });
    return this.getAdminByEmail(cleanEmail);
  },

  // ── ADMIN OTP METHODS ─────────────────────────────────────────────────────
  async saveAdminOtp(email: string, otp: string, ttlSeconds = 600) {
    const cleanEmail = email.toLowerCase().trim();
    const id = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    await supabase.from("admin_otps").delete().eq("email", cleanEmail);
    await supabase.from("admin_otps").insert({
      id,
      email: cleanEmail,
      otp,
      attempts: 0,
      expiresAt,
      createdAt: now,
    });
    return { id, email: cleanEmail, expiresAt };
  },

  async getAdminOtp(email: string): Promise<AdminOtpRecord | null> {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data } = await supabase
      .from("admin_otps")
      .select("*")
      .eq("email", cleanEmail)
      .order("expiresAt", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  },

  async incrementOtpAttempts(email: string): Promise<AdminOtpRecord | null> {
    const cleanEmail = email.toLowerCase().trim();
    const current = await this.getAdminOtp(cleanEmail);
    if (!current) return null;

    const supabase = getSupabase();
    if (!supabase) return null;

    const { data } = await supabase
      .from("admin_otps")
      .update({ attempts: (current.attempts || 0) + 1 })
      .eq("email", cleanEmail)
      .select()
      .maybeSingle();
    return data || null;
  },

  async deleteAdminOtp(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabase();
    if (!supabase) return;

    await supabase.from("admin_otps").delete().eq("email", cleanEmail);
  },

  async getOtpCooldownRemaining(email: string, cooldownSeconds = 60): Promise<number> {
    const current = await this.getAdminOtp(email);
    if (!current) return 0;
    const createdAtMs = new Date(current.createdAt).getTime();
    if (isNaN(createdAtMs)) return 0;
    const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1000);
    if (elapsedSeconds < cooldownSeconds) {
      return cooldownSeconds - elapsedSeconds;
    }
    return 0;
  },

  // ── SUBSCRIBERS ───────────────────────────────────────────────────────────
  async getSubscribers(): Promise<SubscriberRecord[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data } = await supabase.from("subscribers").select("*").order("createdAt", { ascending: false });
    return (data || []).map((r) => ({ ...r, _id: r.id }));
  },

  async getSubscriberByEmail(email: string): Promise<SubscriberRecord | null> {
    const cleanEmail = email.toLowerCase().trim();
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data } = await supabase.from("subscribers").select("*").eq("email", cleanEmail).maybeSingle();
    return data ? { ...data, _id: data.id } : null;
  },

  async addSubscriber(email: string): Promise<SubscriberRecord | null> {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const cleanEmail = email.toLowerCase().trim();

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } = await supabase.from("subscribers").insert({
      id,
      email: cleanEmail,
      status: "active",
      createdAt: now,
    }).select().single();
    if (error) throw new Error(error.message);
    return data ? { ...data, _id: data.id } : null;
  },

  async deleteSubscriber(id: string): Promise<any> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data } = await supabase.from("subscribers").select("*").eq("id", id).maybeSingle();
    await supabase.from("subscribers").delete().eq("id", id);
    return data;
  },

  // ── BLOGS ─────────────────────────────────────────────────────────────────
  async getBlogs(filters?: { category?: string; search?: string; featured?: boolean; published?: boolean; limit?: number }): Promise<BlogRecord[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase.from("blogs").select("*");
    if (filters?.category && filters.category !== "All") {
      query = query.eq("category", filters.category);
    }
    if (filters?.featured !== undefined) {
      query = query.eq("featured", filters.featured);
    }
    if (filters?.published !== undefined) {
      query = query.eq("published", filters.published);
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      query = query.or(`title.ilike.${term},excerpt.ilike.${term},category.ilike.${term},aeoSummary.ilike.${term}`);
    }
    query = query.order("createdAt", { ascending: false });
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) {
      console.error("[Supabase getBlogs error]", error);
      return [];
    }
    return (data || []).map(formatBlog);
  },

  async getBlogById(id: string): Promise<BlogRecord | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from("blogs").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return formatBlog(data);
  },

  async getBlogBySlug(slug: string): Promise<BlogRecord | null> {
    const cleanSlug = slug.toLowerCase().trim();
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase.from("blogs").select("*").eq("slug", cleanSlug).maybeSingle();
    if (error || !data) return null;
    return formatBlog(data);
  },

  async createBlog(data: CreateBlogInput): Promise<BlogRecord | null> {
    const id = data.id || `blog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const slug = (data.slug || data.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const blogRecord = {
      id,
      title: data.title,
      slug,
      excerpt: data.excerpt || "",
      content: data.content,
      coverImage: data.coverImage || "",
      category: data.category || "General",
      author: data.author || "GoAmaze Editorial",
      readTime: data.readTime || "5 min read",
      seoTitle: data.seoTitle || data.title,
      seoDescription: data.seoDescription || data.excerpt || "",
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      aeoSummary: data.aeoSummary || "",
      geoTarget: data.geoTarget || "India",
      faqSchema: Array.isArray(data.faqSchema) ? data.faqSchema : [],
      productIds: Array.isArray(data.productIds) ? data.productIds : [],
      featured: Boolean(data.featured),
      published: data.published !== undefined ? Boolean(data.published) : true,
      createdAt: now,
      updatedAt: now,
    };

    const { data: created, error } = await supabase.from("blogs").insert(blogRecord).select().single();
    if (error) throw new Error(error.message);
    return created ? formatBlog(created) : null;
  },

  async updateBlog(id: string, data: BlogInput): Promise<BlogRecord | null> {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const now = new Date().toISOString();
    const updateData: any = { updatedAt: now };
    const allowed = ["title", "slug", "excerpt", "content", "coverImage", "category", "author", "readTime", "seoTitle", "seoDescription", "aeoSummary", "geoTarget"] as const;
    for (const f of allowed) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    if (data.keywords !== undefined) updateData.keywords = Array.isArray(data.keywords) ? data.keywords : [];
    if (data.faqSchema !== undefined) updateData.faqSchema = Array.isArray(data.faqSchema) ? data.faqSchema : [];
    if (data.productIds !== undefined) updateData.productIds = Array.isArray(data.productIds) ? data.productIds : [];
    if (data.featured !== undefined) updateData.featured = Boolean(data.featured);
    if (data.published !== undefined) updateData.published = Boolean(data.published);

    const { data: updated, error } = await supabase.from("blogs").update(updateData).eq("id", id).select().maybeSingle();
    if (error) throw new Error(error.message);
    return updated ? formatBlog(updated) : null;
  },

  async deleteBlog(id: string): Promise<BlogRecord | null> {
    const blog = await this.getBlogById(id);
    if (!blog) return null;

    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { error } = await supabase.from("blogs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return blog;
  },

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  async getAnalytics() {
    const supabase = getSupabase();
    if (supabase) {
      const [pRes, cRes, sRes, fRes, bRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("subscribers").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("featured", true),
        supabase.from("blogs").select("id", { count: "exact", head: true }),
      ]);
      return {
        totalProducts: pRes.count || 0,
        totalCategories: cRes.count || CANONICAL_CATEGORIES.length,
        totalThemes: PRIMARY_THEMES.length,
        totalSubscribers: sRes.count || 0,
        featuredProducts: fRes.count || 0,
        totalBlogs: bRes.count || 0,
      };
    }

    return {
      totalProducts: Array.isArray(productsJsonFallback) ? productsJsonFallback.length : 0,
      totalCategories: CANONICAL_CATEGORIES.length,
      totalThemes: PRIMARY_THEMES.length,
      totalSubscribers: 0,
      featuredProducts: Array.isArray(productsJsonFallback) ? productsJsonFallback.filter((p: any) => p.featured).length : 0,
      totalBlogs: 0,
    };
  },

  async syncCatalog() {
    const seedItems = Array.isArray(productsJsonFallback) ? productsJsonFallback : [];
    let count = 0;
    for (const p of seedItems) {
      await this.upsertProduct({
        ...p,
        id: String(p.id),
      } as any);
      count++;
    }
    const analytics = await this.getAnalytics();
    return { success: true, count, total: analytics.totalProducts };
  },

  async reseed() {
    return await this.syncCatalog();
  },
};

export default function dbConnect() {
  return Promise.resolve();
}
