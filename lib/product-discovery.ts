/**
 * GoAmaze Product Discovery Service
 * 
 * Reusable server-side product discovery service interacting with the Amazon Creators API.
 * Discovers products based on lifestyle themes, search indexes, or custom keywords,
 * normalizes canonical records, deduplicates against existing catalog, and queues for AI analysis.
 */

import { db, ProductRecord } from "@/lib/db";
import {
  extractAsin,
  normalizeCreatorItem,
  getCreatorAccessToken,
  CREATOR_API_RESOURCES,
  NormalizedCreatorProduct,
} from "@/lib/amazon-creator";
import { getThemeBySlug, PRIMARY_THEMES, CANONICAL_CATEGORIES } from "@/lib/taxonomy";
import { normalizeMarketplace, DEFAULT_MARKETPLACE, DEFAULT_PARTNER_TAG } from "@/lib/product-identifier";

const SEARCH_API_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";

export interface DiscoveryJobParams {
  themeSlug?: string;
  categorySlug?: string;
  searchIndex?: string;
  keywords?: string;
  limit?: number;
  page?: number;
  marketplace?: string;
  partnerTag?: string;
  jobId?: string;
  autoQueueAI?: boolean;
}

export interface DiscoveryJobReport {
  success: boolean;
  jobId: string;
  timestamp: string;
  searchIndexUsed: string;
  keywordsUsed: string;
  themeSlug?: string;
  categorySlug?: string;
  totalFoundOnAmazon: number;
  discoveredCount: number;
  addedCount: number;
  updatedCount: number;
  queuedForAICount: number;
  products: ProductRecord[];
  errors: string[];
}

/**
 * Resolves Amazon SearchIndex for a given theme, category, or explicit index.
 */
function resolveDiscoverySearchIndex(params: DiscoveryJobParams): string {
  if (params.searchIndex && params.searchIndex !== "All") {
    return params.searchIndex;
  }

  if (params.themeSlug) {
    const cleanTheme = params.themeSlug.toLowerCase().trim();
    if (cleanTheme === "smart-living") return "HomeAndKitchen";
    if (cleanTheme === "work-study-gaming") return "OfficeProducts";
    if (cleanTheme === "kitchen-everyday-essentials") return "HomeAndKitchen";
  }

  const catSlug = params.categorySlug;
  if (catSlug) {
    const cat = CANONICAL_CATEGORIES.find((c) => c.slug === catSlug.toLowerCase().trim());
    if (cat?.amazonSearchIndex) return cat.amazonSearchIndex;
  }

  return "All";
}

/**
 * Resolves keywords for discovery if not explicitly passed by caller.
 */
function resolveDiscoveryKeywords(params: DiscoveryJobParams): string {
  if (params.keywords && params.keywords.trim()) {
    return params.keywords.trim();
  }

  if (params.themeSlug) {
    const theme = getThemeBySlug(params.themeSlug);
    if (theme && theme.defaultKeywords.length > 0) {
      // Pick random or primary keyword set
      return theme.defaultKeywords[0];
    }
  }

  const catSlug = params.categorySlug;
  if (catSlug) {
    const cat = CANONICAL_CATEGORIES.find((c) => c.slug === catSlug.toLowerCase().trim());
    if (cat) return cat.name;
  }

  return "trending products";
}

/**
 * Executes a server-side product discovery job.
 */
export async function executeProductDiscoveryJob(params: DiscoveryJobParams): Promise<DiscoveryJobReport> {
  const jobId = params.jobId || `disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  const marketplace = normalizeMarketplace(params.marketplace || DEFAULT_MARKETPLACE);
  const partnerTag = params.partnerTag || DEFAULT_PARTNER_TAG;
  const searchIndex = resolveDiscoverySearchIndex(params);
  const keywords = resolveDiscoveryKeywords(params);
  const requestedLimit = Math.min(Math.max(1, params.limit || 10), 30);
  const startPage = Math.min(Math.max(1, params.page || 1), 10);

  let rawItems: any[] = [];
  let totalFoundOnAmazon = 0;

  try {
    const accessToken = await getCreatorAccessToken();

    const searchPayload: Record<string, any> = {
      marketplace,
      partnerTag,
      resources: CREATOR_API_RESOURCES,
      searchIndex,
      itemCount: Math.min(requestedLimit, 10),
      itemPage: startPage,
      keywords,
    };

    const res = await fetch(SEARCH_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-marketplace": marketplace,
      },
      body: JSON.stringify(searchPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      errors.push(`Amazon API query failed (${res.status}): ${errText}`);
    } else {
      const data = await res.json();
      rawItems = data?.searchResult?.items || [];
      totalFoundOnAmazon = data?.searchResult?.totalResultCount || rawItems.length;
    }
  } catch (err: any) {
    errors.push(`Discovery network error: ${err.message}`);
  }

  if (rawItems.length === 0) {
    return {
      success: errors.length === 0,
      jobId,
      timestamp,
      searchIndexUsed: searchIndex,
      keywordsUsed: keywords,
      themeSlug: params.themeSlug,
      categorySlug: params.categorySlug,
      totalFoundOnAmazon,
      discoveredCount: 0,
      addedCount: 0,
      updatedCount: 0,
      queuedForAICount: 0,
      products: [],
      errors,
    };
  }

  // Deduplicate discovered items within the batch by ASIN
  const seenAsins = new Set<string>();
  const uniqueItems = rawItems.filter((item) => {
    const asin = item.asin || item.id;
    if (!asin || seenAsins.has(asin)) return false;
    seenAsins.add(asin);
    return true;
  });

  const savedProducts: ProductRecord[] = [];
  let addedCount = 0;
  let updatedCount = 0;

  for (const rawItem of uniqueItems) {
    const normalized = normalizeCreatorItem(rawItem, params.categorySlug || "General", partnerTag);

    // Initial theme & category suggestions from discovery context
    const suggestedThemes = params.themeSlug ? [params.themeSlug] : [];
    const suggestedCategories = params.categorySlug ? [params.categorySlug] : [];

    try {
      // Upsert canonical product record into database
      const existingProduct = await db.getProductById(`prod_amz_${normalized.asin.toLowerCase()}`);
      const isNew = !existingProduct;

      const record = await db.upsertProduct(
        {
          id: `prod_amz_${normalized.asin.toLowerCase()}`,
          title: normalized.title,
          subtitle: normalized.subtitle,
          description: normalized.description,
          price: normalized.price,
          originalPrice: normalized.originalPrice,
          unitPrice: normalized.unitPrice,
          image: normalized.image,
          images: normalized.images,
          affiliateLink: normalized.affiliateLink,
          badge: normalized.badge,
          rating: normalized.rating,
          reviews: normalized.reviews,
          source: "amazon",
          themes: suggestedThemes,
          categories: suggestedCategories,
          analysisStatus: "PENDING_ANALYSIS", // Queue for AI analysis
        },
        { sourceRule: "api" }
      );

      if (record) {
        savedProducts.push(record);
        if (isNew) addedCount++;
        else updatedCount++;
      }
    } catch (saveErr: any) {
      errors.push(`Error saving ASIN ${normalized.asin}: ${saveErr.message}`);
    }
  }

  return {
    success: errors.length === 0 || savedProducts.length > 0,
    jobId,
    timestamp,
    searchIndexUsed: searchIndex,
    keywordsUsed: keywords,
    themeSlug: params.themeSlug,
    categorySlug: params.categorySlug,
    totalFoundOnAmazon,
    discoveredCount: uniqueItems.length,
    addedCount,
    updatedCount,
    queuedForAICount: savedProducts.length,
    products: savedProducts,
    errors,
  };
}
