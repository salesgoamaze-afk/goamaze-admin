import bcrypt from "bcryptjs";
import productsJsonFallback from "@/data/products.json";
import { getSupabase } from "./supabase";

export interface ProductRecord {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  originalPrice: string;
  unitPrice?: string;
  category: string;
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
  aiScore?: number;
  aiScoreBreakdown?: Record<string, number>;
  aiSummary?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
  recommendationReason?: string;
  curationStatus?: "approved" | "pending" | "rejected" | string;
  confidenceLevel?: "high" | "medium" | "low" | string;
  dataQualityFlags?: string[];
  lastAnalyzedAt?: string;
}

export type ProductInput = Omit<Partial<ProductRecord>, "featured"> & {
  featured?: boolean;
};

export interface CreateProductInput {
  id?: string;
  title: string;
  subtitle?: string;
  description?: string;
  price: string;
  originalPrice?: string;
  unitPrice?: string;
  category: string;
  image: string;
  images?: string[];
  instagramUrl?: string;
  affiliateLink: string;
  badge?: string;
  rating?: number | null;
  reviews?: number | null;
  featured?: boolean;
  aiScore?: number | null;
  aiScoreBreakdown?: Record<string, number>;
  aiSummary?: string;
  pros?: string[];
  cons?: string[];
  bestFor?: string;
  recommendationReason?: string;
  curationStatus?: string;
  confidenceLevel?: string;
  dataQualityFlags?: string[];
  lastAnalyzedAt?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  icon: string;
  slug: string;
  createdAt: string;
  _id?: string;
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

const DEFAULT_CATEGORY_ICONS: Record<string, string> = {
  "Festival Special - Diwali": "🪔",
  "Smart Kitchen": "🍳",
  "Aesthetic Living": "🛋️",
  "Desk Setup": "🖥️",
  "Cozy Wellness": "🕯️",
  "Coffee Corner": "☕",
  "Green Living": "🌿",
  "Gaming Zone": "🎮",
  "Study Space": "📚",
  "Miscellaneous": "✨",
  // Legacy / fallback categories
  "Kitchen Appliances": "🍳",
  "Home Decoration": "🛋️",
  "Lifestyle Products": "✨",
  "Study & Workspace": "🖥️",
  "Gym": "🏋️",
  "Food Items": "🍯",
  "Apparel": "👕",
};

const DEFAULT_CATEGORIES: CategoryRecord[] = [
  { id: "cat_festival_diwali", name: "Festival Special - Diwali", icon: "🪔", slug: "festival-special-diwali", createdAt: new Date().toISOString() },
  { id: "cat_smart_kitchen", name: "Smart Kitchen", icon: "🍳", slug: "smart-kitchen", createdAt: new Date().toISOString() },
  { id: "cat_aesthetic_living", name: "Aesthetic Living", icon: "🛋️", slug: "aesthetic-living", createdAt: new Date().toISOString() },
  { id: "cat_desk_setup", name: "Desk Setup", icon: "🖥️", slug: "desk-setup", createdAt: new Date().toISOString() },
  { id: "cat_cozy_wellness", name: "Cozy Wellness", icon: "🕯️", slug: "cozy-wellness", createdAt: new Date().toISOString() },
  { id: "cat_coffee_corner", name: "Coffee Corner", icon: "☕", slug: "coffee-corner", createdAt: new Date().toISOString() },
  { id: "cat_green_living", name: "Green Living", icon: "🌿", slug: "green-living", createdAt: new Date().toISOString() },
  { id: "cat_gaming_zone", name: "Gaming Zone", icon: "🎮", slug: "gaming-zone", createdAt: new Date().toISOString() },
  { id: "cat_study_space", name: "Study Space", icon: "📚", slug: "study-space", createdAt: new Date().toISOString() },
  { id: "cat_miscellaneous", name: "Miscellaneous", icon: "✨", slug: "miscellaneous", createdAt: new Date().toISOString() },
];

// FORMATTING HELPERS
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

  // Parse embedded AI recommendation metadata if present in description
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

  return {
    ...r,
    _id: String(r.id),
    id: String(r.id),
    description: displayDescription,
    images: parsedImages,
    instagramUrl: r.instagramUrl || "",
    featured: Boolean(r.featured),
    rating: Number(r.rating ?? 4.5),
    reviews: Number(r.reviews ?? 0),

    // AI Recommendation Structured Fields
    aiScore: r.aiScore !== undefined ? Number(r.aiScore) : aiData.aiScore,
    aiScoreBreakdown: r.aiScoreBreakdown || aiData.scoreBreakdown,
    rank: r.rank !== undefined ? Number(r.rank) : aiData.rank,
    award: r.award || aiData.award || (r.badge && r.badge.includes("Best") ? r.badge : undefined),
    aiSummary: r.aiSummary || aiData.aiSummary || "",
    pros: Array.isArray(r.pros) ? r.pros : (aiData.pros || []),
    cons: Array.isArray(r.cons) ? r.cons : (aiData.cons || []),
    bestFor: r.bestFor || aiData.bestFor || "",
    recommendationReason: r.recommendationReason || aiData.recommendationReason || "",
    targetAudience: r.targetAudience || aiData.targetAudience || "",
    curationStatus: r.curationStatus || aiData.curationStatus || "pending",
    confidenceLevel: r.confidenceLevel || aiData.confidenceLevel || "high",
    dataQualityFlags: Array.isArray(r.dataQualityFlags) ? r.dataQualityFlags : (aiData.dataQualityFlags || []),
    lastAnalyzedAt: r.lastAnalyzedAt || aiData.lastAnalyzedAt || "",
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
// REPOSITORY METHODS (Supabase Database Layer)
// ─────────────────────────────────────────────────────────────────────────────

export const db = {
  // PRODUCTS
  async getProducts(filters?: { category?: string; search?: string; featured?: boolean; limit?: number }): Promise<ProductRecord[]> {
    const supabase = getSupabase();
    if (supabase) {
      let query = supabase.from("products").select("*");
      if (filters?.category && filters.category !== "All") {
        query = query.ilike("category", filters.category);
      }
      if (filters?.featured !== undefined) {
        query = query.eq("featured", filters.featured);
      }
      if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(`title.ilike.${term},subtitle.ilike.${term},category.ilike.${term},badge.ilike.${term}`);
      }
      query = query.order("featured", { ascending: false }).order("createdAt", { ascending: false });
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      const { data, error } = await query;
      if (error) {
        console.error("[Supabase getProducts error]", error);
        return [];
      }
      return (data || []).map(formatProduct);
    }

    // Static Fallback when Supabase is not configured
    let products = Array.isArray(productsJsonFallback) ? (productsJsonFallback as any[]).map(formatProduct) : [];
    if (filters?.category && filters.category !== "All") {
      products = products.filter((p) => p.category.toLowerCase() === filters.category!.toLowerCase());
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
          p.badge?.toLowerCase().includes(q)
      );
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
      return data ? formatProduct(data) : null;
    }

    // Static Fallback
    const found = (productsJsonFallback as any[]).find((p) => String(p.id) === idStr);
    return found ? formatProduct(found) : null;
  },

  async createProduct(data: CreateProductInput): Promise<ProductRecord | null> {
    const id = data.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const imagesArray = Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.image ? [data.image] : []);
    const primaryImage = data.image || imagesArray[0] || "";

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    // Embed structured AI metadata in description if provided and not yet embedded
    let finalDescription = data.description || "";
    if (data.aiScore !== undefined && !finalDescription.includes("<!-- AI_DATA:")) {
      const aiMeta = {
        aiScore: data.aiScore,
        scoreBreakdown: data.aiScoreBreakdown,
        aiSummary: data.aiSummary,
        pros: data.pros,
        cons: data.cons,
        bestFor: data.bestFor,
        recommendationReason: data.recommendationReason,
        confidenceLevel: data.confidenceLevel,
        curationStatus: data.curationStatus || "approved",
        lastAnalyzedAt: data.lastAnalyzedAt || now,
      };
      finalDescription = `${finalDescription}\n\n<!-- AI_DATA: ${JSON.stringify(aiMeta)} -->`;
    }

    const newRecord: any = {
      id,
      title: data.title,
      subtitle: data.subtitle || data.title,
      description: finalDescription,
      price: data.price,
      originalPrice: data.originalPrice || data.price,
      unitPrice: data.unitPrice || "",
      category: data.category,
      image: primaryImage,
      images: imagesArray,
      instagramUrl: data.instagramUrl || "",
      affiliateLink: data.affiliateLink,
      badge: data.badge || "New",
      rating: data.rating !== undefined ? Number(data.rating) : 4.5,
      reviews: data.reviews !== undefined ? Number(data.reviews) : 0,
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
      console.error("[Supabase createProduct error]", error);
      throw new Error(error.message);
    }
    return created ? formatProduct(created) : null;
  },

  async checkExistingAsins(asins: string[]): Promise<string[]> {
    if (!asins || asins.length === 0) return [];
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("products").select("id, affiliateLink");
      if (error || !data) return [];
      const found: string[] = [];
      for (const asin of asins) {
        const asinLower = asin.toLowerCase();
        const exists = data.some(
          (p: any) =>
            p.id?.toLowerCase().includes(asinLower) ||
            p.affiliateLink?.toLowerCase().includes(asinLower)
        );
        if (exists) found.push(asin);
      }
      return found;
    }

    const local = (productsJsonFallback as any[]) || [];
    return asins.filter((asin) => {
      const asinLower = asin.toLowerCase();
      return local.some(
        (p: any) =>
          String(p.id).toLowerCase().includes(asinLower) ||
          String(p.affiliateLink || "").toLowerCase().includes(asinLower)
      );
    });
  },

  async createProductsBatch(records: CreateProductInput[]): Promise<{ added: ProductRecord[]; count: number }> {
    if (!records || records.length === 0) return { added: [], count: 0 };
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const preparedRecords = records.map((data, index) => {
      const id = data.id || `prod_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
      const imagesArray = Array.isArray(data.images) && data.images.length > 0 ? data.images : (data.image ? [data.image] : []);
      const primaryImage = data.image || imagesArray[0] || "";

      let finalDescription = data.description || "";
      if (data.aiScore !== undefined && !finalDescription.includes("<!-- AI_DATA:")) {
        const aiMeta = {
          aiScore: data.aiScore,
          scoreBreakdown: data.aiScoreBreakdown,
          aiSummary: data.aiSummary,
          pros: data.pros,
          cons: data.cons,
          bestFor: data.bestFor,
          recommendationReason: data.recommendationReason,
          confidenceLevel: data.confidenceLevel,
          curationStatus: data.curationStatus || "approved",
          lastAnalyzedAt: data.lastAnalyzedAt || now,
        };
        finalDescription = `${finalDescription}\n\n<!-- AI_DATA: ${JSON.stringify(aiMeta)} -->`;
      }

      return {
        id,
        title: data.title,
        subtitle: data.subtitle || data.title,
        description: finalDescription,
        price: data.price,
        originalPrice: data.originalPrice || data.price,
        unitPrice: data.unitPrice || "",
        category: data.category,
        image: primaryImage,
        images: imagesArray,
        instagramUrl: data.instagramUrl || "",
        affiliateLink: data.affiliateLink,
        badge: data.badge || "New",
        rating: data.rating !== undefined ? Number(data.rating) : 4.5,
        reviews: data.reviews !== undefined ? Number(data.reviews) : 0,
        featured: Boolean(data.featured),
        createdAt: now,
        updatedAt: now,
      };
    });

    if (supabase) {
      const { data: created, error } = await supabase
        .from("products")
        .insert(preparedRecords)
        .select();

      if (error) {
        console.error("[Supabase createProductsBatch error]", error);
        throw new Error(error.message);
      }

      const added = (created || []).map(formatProduct);
      return { added, count: added.length };
    }

    const added = preparedRecords.map(formatProduct);
    return { added, count: added.length };
  },

  async updateProduct(id: string | number, data: ProductInput): Promise<ProductRecord | null> {
    const supabase = getSupabase();
    const idStr = String(id).trim();

    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const now = new Date().toISOString();
    const updateData: any = { updatedAt: now };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.description !== undefined) updateData.description = data.description;
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
    if (data.rating !== undefined) updateData.rating = Number(data.rating);
    if (data.reviews !== undefined) updateData.reviews = Number(data.reviews);
    if (data.featured !== undefined) updateData.featured = Boolean(data.featured);

    // AI metadata update support
    if (data.aiScore !== undefined || data.bestFor !== undefined || data.aiSummary !== undefined) {
      const existingProduct = await this.getProductById(idStr);
      const cleanDesc = (data.description !== undefined ? data.description : existingProduct?.description || "").replace(/<!-- AI_DATA:[\s\S]*?-->/g, "").trim();
      const aiMeta = {
        aiScore: data.aiScore !== undefined ? data.aiScore : existingProduct?.aiScore,
        scoreBreakdown: data.aiScoreBreakdown || existingProduct?.aiScoreBreakdown,
        aiSummary: data.aiSummary !== undefined ? data.aiSummary : existingProduct?.aiSummary,
        pros: data.pros !== undefined ? data.pros : existingProduct?.pros,
        cons: data.cons !== undefined ? data.cons : existingProduct?.cons,
        bestFor: data.bestFor !== undefined ? data.bestFor : existingProduct?.bestFor,
        recommendationReason: data.recommendationReason !== undefined ? data.recommendationReason : existingProduct?.recommendationReason,
        confidenceLevel: data.confidenceLevel || existingProduct?.confidenceLevel || "high",
        curationStatus: data.curationStatus || existingProduct?.curationStatus || "approved",
        lastAnalyzedAt: data.lastAnalyzedAt || now,
      };
      updateData.description = `${cleanDesc}\n\n<!-- AI_DATA: ${JSON.stringify(aiMeta)} -->`;
    }

    const { data: updated, error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", idStr)
      .select()
      .maybeSingle();

    if (error) {
      console.error("[Supabase updateProduct error]", error);
      throw new Error(error.message);
    }
    return updated ? formatProduct(updated) : null;
  },

  async deleteProduct(id: string | number): Promise<ProductRecord | null> {
    const product = await this.getProductById(id);
    if (!product) return null;

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      console.error("[Supabase deleteProduct error]", error);
      throw new Error(error.message);
    }
    return product;
  },

  // CATEGORIES
  async getCategories(): Promise<CategoryRecord[]> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("categories").select("*").order("name", { ascending: true });
      if (error) {
        console.error("[Supabase getCategories error]", error);
        return [];
      }
      return (data || []).map((r) => {
        const cleanIcon = (!r.icon || r.icon.includes("?")) ? (DEFAULT_CATEGORY_ICONS[r.name] || "🏷️") : r.icon;
        return { ...r, icon: cleanIcon, _id: r.id };
      });
    }

    // Static Fallback
    return DEFAULT_CATEGORIES;
  },

  async getCategoryById(id: string): Promise<CategoryRecord | null> {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("categories").select("*").eq("id", id).maybeSingle();
      if (error || !data) return null;
      return { ...data, _id: data.id };
    }

    const found = DEFAULT_CATEGORIES.find((c) => c.id === id || c.slug === id);
    return found ? { ...found, _id: found.id } : null;
  },

  async createCategory(name: string, icon = "🏷️"): Promise<CategoryRecord | null> {
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `cat-${Date.now()}`;
    const now = new Date().toISOString();

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const { data, error } = await supabase
      .from("categories")
      .upsert({ id, name: name.trim(), icon, slug, createdAt: now }, { onConflict: "name" })
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
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return cat;
  },

  // ADMIN USERS
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

    // Default In-Memory Admin Fallback for authorized emails when DB is unconfigured
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
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
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

  // ADMIN OTP METHODS
  async saveAdminOtp(email: string, otp: string, ttlSeconds = 600) {
    const cleanEmail = email.toLowerCase().trim();
    const id = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
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

  // SUBSCRIBERS
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
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
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

  // BLOGS
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
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
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
    if (error) {
      console.error("[Supabase createBlog error]", error);
      throw new Error(error.message);
    }
    return created ? formatBlog(created) : null;
  },

  async updateBlog(id: string, data: BlogInput): Promise<BlogRecord | null> {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

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
    if (error) {
      console.error("[Supabase updateBlog error]", error);
      throw new Error(error.message);
    }
    return updated ? formatBlog(updated) : null;
  },

  async deleteBlog(id: string): Promise<BlogRecord | null> {
    const blog = await this.getBlogById(id);
    if (!blog) return null;

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const { error } = await supabase.from("blogs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return blog;
  },

  // ANALYTICS
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
        totalCategories: cRes.count || 0,
        totalSubscribers: sRes.count || 0,
        featuredProducts: fRes.count || 0,
        totalBlogs: bRes.count || 0,
      };
    }

    return {
      totalProducts: Array.isArray(productsJsonFallback) ? productsJsonFallback.length : 0,
      totalCategories: DEFAULT_CATEGORIES.length,
      totalSubscribers: 0,
      featuredProducts: Array.isArray(productsJsonFallback) ? productsJsonFallback.filter((p: any) => p.featured).length : 0,
      totalBlogs: 0,
    };
  },

  // SEED & SYNC
  async syncCatalog() {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    const seedItems = Array.isArray(productsJsonFallback) ? productsJsonFallback : [];
    let count = 0;
    for (const p of seedItems) {
      const id = String(p.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const images = Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : []);
      await this.createProduct({
        ...p,
        id,
        images,
        image: p.image || images[0] || "",
        rating: p.rating ? Number(p.rating) : 4.5,
        reviews: p.reviews ? Number(p.reviews) : 0,
      } as any);
      count++;
    }

    const analytics = await this.getAnalytics();
    return { success: true, count, total: analytics.totalProducts };
  },

  async reseed() {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    await supabase.from("products").delete().neq("id", "none");
    await supabase.from("categories").delete().neq("id", "none");

    const now = new Date().toISOString();
    for (const cat of DEFAULT_CATEGORIES) {
      await supabase.from("categories").upsert({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        slug: cat.slug,
        createdAt: now,
      }, { onConflict: "name" });
    }

    for (const p of (productsJsonFallback as any[])) {
      const id = String(p.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const images = Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : []);
      await this.createProduct({
        ...p,
        id,
        images,
        image: p.image || images[0] || "",
        rating: p.rating ? Number(p.rating) : 4.5,
        reviews: p.reviews ? Number(p.reviews) : 0,
      } as any);
    }

    return this.getAnalytics();
  },
};

export default function dbConnect() {
  return Promise.resolve();
}
