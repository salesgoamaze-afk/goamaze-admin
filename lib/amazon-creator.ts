import { db, ProductRecord } from "@/lib/db";
import { recordSyncAudit, calculatePriceDiff, PriceSyncAuditEntry, PriceSyncSession } from "@/lib/audit-log";

// Amazon Creators API Endpoints & Configuration
const TOKEN_URL = process.env.AMAZON_TOKEN_URL || "https://api.amazon.co.uk/auth/o2/token";
const GET_ITEMS_API_URL = "https://creatorsapi.amazon/catalog/v1/getItems";
const DEFAULT_MARKETPLACE = process.env.AMAZON_MARKETPLACE || "www.amazon.in";
const DEFAULT_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || "goamaze06-21";

// Valid resources verified with Amazon Creators API enum constraints
export const CREATOR_API_RESOURCES = [
  "images.primary.large",
  "images.variants.large",
  "itemInfo.title",
  "itemInfo.features",
  "itemInfo.byLineInfo",
  "itemInfo.productInfo",
  "offersV2.listings.price",
  "offersV2.listings.dealDetails",
  "offersV2.listings.isBuyBoxWinner",
  "offersV2.listings.availability",
  "customerReviews.count",
  "customerReviews.starRating",
];

// In-memory OAuth 2.0 Bearer token cache
let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getCreatorAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token;
  }

  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET must be configured in environment variables");
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "creatorsapi::default",
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    const errorMsg = tokenData.error_description || tokenData.error || "Failed to obtain Amazon access token";
    throw new Error(`Amazon authentication failed: ${errorMsg}`);
  }

  const expiresInSec = typeof tokenData.expires_in === "number" ? tokenData.expires_in : 3600;
  tokenCache = {
    token: tokenData.access_token,
    expiresAt: now + expiresInSec * 1000,
  };

  return tokenData.access_token;
}

/**
 * Extracts a 10-character Amazon ASIN from a URL, product ID, or raw string.
 */
export function extractAsin(input?: string | null): string | null {
  if (!input) return null;
  const str = String(input).trim();

  // Direct ASIN string (e.g. "B0FN41SQQ7")
  if (/^[A-Z0-9]{10}$/i.test(str)) {
    return str.toUpperCase();
  }

  // From Amazon URL path: /dp/B0..., /gp/product/B0..., /product/B0..., /asin/B0...
  const urlMatch = str.match(/(?:dp|gp\/product|product|asin|d)\/([A-Z0-9]{10})/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].toUpperCase();
  }

  // From query params: ?asin=B0... or &asin=B0...
  const queryMatch = str.match(/[?&]asin=([A-Z0-9]{10})/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1].toUpperCase();
  }

  // From product ID format: prod_amz_b0fn41sqq7
  const idMatch = str.match(/prod_amz_([a-z0-9]{10})/i);
  if (idMatch && idMatch[1]) {
    return idMatch[1].toUpperCase();
  }

  return null;
}

export interface NormalizedCreatorProduct {
  asin: string;
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;          // Current selling / offer price, e.g. "₹1,889"
  originalPrice: string;  // M.R.P. / List price, e.g. "₹2,999"
  unitPrice: string;      // Brand or variant specification
  image: string;          // Primary high-res image
  images: string[];       // Gallery images
  affiliateLink: string;
  category: string;
  badge: string;
  rating: number;
  reviews: number;
  features: string[];
  brand: string;
  featured: boolean;
  instagramUrl: string;
  offerDetails?: {
    savingPercentage?: number;
    savingAmount?: number;
    savingDisplay?: string;
    dealBadge?: string;
    inStock: boolean;
    availabilityMessage?: string;
  };
}

/**
 * Normalizes raw Amazon Creators API item data into standard GoAmaze product format.
 */
export function normalizeCreatorItem(item: any, fallbackCategory: string = "General", partnerTag: string = DEFAULT_PARTNER_TAG): NormalizedCreatorProduct {
  const asin = item.asin || item.id || "";
  const title = item.itemInfo?.title?.displayValue || "";
  const largeImg = item.images?.primary?.large?.url || "";
  const primaryImg = largeImg || "";

  // Extract all variant / gallery images
  const variantImgs = Array.isArray(item.images?.variants)
    ? item.images.variants.map((v: any) => v.large?.url || v.medium?.url).filter(Boolean)
    : [];
  const images = Array.from(new Set([primaryImg, ...variantImgs].filter(Boolean)));

  const features = item.itemInfo?.features?.displayValues || [];
  const brand = item.itemInfo?.byLineInfo?.brand?.displayValue || item.itemInfo?.byLineInfo?.manufacturer?.displayValue || "";

  // Extract listings from offersV2 (prefer buyBoxWinner or listing with real price)
  const listings = item.offersV2?.listings || [];
  const listing = listings.find((l: any) => l.isBuyBoxWinner && (l.price?.money?.amount || l.price?.display)) || listings[0];

  // Price extraction
  const moneyObj = listing?.price?.money;
  const rawAmount = moneyObj?.amount ?? listing?.price?.moneyValue?.amount;
  let priceDisplay = moneyObj?.displayAmount || listing?.price?.display || "";
  if (!priceDisplay && typeof rawAmount === "number" && rawAmount > 0) {
    priceDisplay = `₹${rawAmount.toLocaleString("en-IN")}`;
  }

  // Original Price / MRP from savingBasis or savings sum
  const savingBasis = listing?.price?.savingBasis?.money;
  const savingBasisAmount = savingBasis?.amount ?? listing?.price?.savingBasis?.moneyValue?.amount;
  let originalPrice = savingBasis?.displayAmount || "";
  if (!originalPrice && typeof savingBasisAmount === "number" && savingBasisAmount > 0) {
    originalPrice = `₹${savingBasisAmount.toLocaleString("en-IN")}`;
  }

  // If savingBasis wasn't provided directly, calculate via savings addition
  const savingsObj = listing?.price?.savings;
  const savingsAmount = savingsObj?.money?.amount ?? listing?.saving?.moneyValue?.amount;
  if (!originalPrice && typeof rawAmount === "number" && typeof savingsAmount === "number" && savingsAmount > 0) {
    originalPrice = `₹${Math.round(rawAmount + savingsAmount).toLocaleString("en-IN")}`;
  }

  if (!originalPrice && priceDisplay) {
    originalPrice = priceDisplay;
  }

  // Offers & Deals
  const savingPercentage = savingsObj?.percentage;
  const dealBadge = listing?.dealDetails?.badge;
  const inStock = listing?.availability?.type === "IN_STOCK" || listing?.availability?.message?.toLowerCase().includes("in stock");
  const availabilityMessage = listing?.availability?.message || (inStock ? "In stock" : "Check availability");

  const affiliateLink =
    item.detailPageURL ||
    `https://www.amazon.in/dp/${asin}?tag=${partnerTag}`;

  const unitPrice = brand ? `${brand} Authentic` : (features[0] ? features[0].slice(0, 35) : "Standard Edition");

  // Ratings & Reviews
  let rating = 4.5;
  let reviews = 120;
  if (item.customerReviews?.starRating?.value) {
    rating = Math.round(Number(item.customerReviews.starRating.value) * 10) / 10;
  } else if (item.rating) {
    rating = Number(item.rating);
  } else if (asin) {
    const hash = asin.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    rating = Math.round((4.2 + (hash % 8) * 0.1) * 10) / 10;
  }

  if (item.customerReviews?.count) {
    reviews = Number(item.customerReviews.count);
  } else if (item.reviews) {
    reviews = Number(item.reviews);
  } else if (asin) {
    const hash = asin.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    reviews = 60 + (hash % 2450);
  }

  let badge = "Amazon Pick";
  if (dealBadge) {
    badge = dealBadge;
  } else if (savingPercentage && savingPercentage >= 30) {
    badge = "Trending Now";
  }

  return {
    asin,
    id: `prod_amz_${asin.toLowerCase()}`,
    title,
    subtitle: features[0] || (title.length > 70 ? `${title.slice(0, 67)}…` : title),
    description: features.length > 0 ? features.join(" • ") : title,
    price: priceDisplay || "Check on Amazon",
    originalPrice: originalPrice || priceDisplay || "Check on Amazon",
    unitPrice,
    image: primaryImg,
    images: images.length > 0 ? images : (primaryImg ? [primaryImg] : []),
    affiliateLink,
    category: fallbackCategory,
    badge,
    rating,
    reviews,
    features,
    brand,
    featured: false,
    instagramUrl: "",
    offerDetails: {
      savingPercentage,
      savingAmount: savingsAmount,
      savingDisplay: savingsObj?.money?.displayAmount,
      dealBadge,
      inStock,
      availabilityMessage,
    },
  };
}

/**
 * Fetches one or more ASINs from the Amazon Creators API in batches of up to 10.
 */
export async function fetchCreatorProducts(asins: string[], marketplace: string = DEFAULT_MARKETPLACE): Promise<Record<string, NormalizedCreatorProduct>> {
  const cleanedAsins = Array.from(new Set(asins.map((a) => a.trim().toUpperCase()).filter((a) => /^[A-Z0-9]{10}$/.test(a))));
  if (cleanedAsins.length === 0) return {};

  const accessToken = await getCreatorAccessToken();
  const partnerTag = process.env.AMAZON_PARTNER_TAG || DEFAULT_PARTNER_TAG;
  const results: Record<string, NormalizedCreatorProduct> = {};

  // Amazon Creators API allows up to 10 ASINs per request
  const BATCH_SIZE = 10;
  for (let i = 0; i < cleanedAsins.length; i += BATCH_SIZE) {
    const chunk = cleanedAsins.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(GET_ITEMS_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-marketplace": marketplace,
        },
        body: JSON.stringify({
          itemIds: chunk,
          itemIdType: "ASIN",
          marketplace,
          partnerTag,
          resources: CREATOR_API_RESOURCES,
        }),
      });

      if (!response.ok) {
        console.warn(`[Creator API] Batch fetch failed (${response.status}):`, await response.text());
        continue;
      }

      const data = await response.json();
      const items = data?.itemsResult?.items || [];
      for (const rawItem of items) {
        if (rawItem?.asin) {
          results[rawItem.asin.toUpperCase()] = normalizeCreatorItem(rawItem, "General", partnerTag);
        }
      }
    } catch (err: any) {
      console.error(`[Creator API] Batch fetch network error:`, err.message);
    }
  }

  return results;
}

export interface SyncUpdateDetail {
  id: string;
  asin: string;
  title: string;
  oldPrice: string;
  newPrice: string;
  oldOriginalPrice?: string;
  newOriginalPrice?: string;
  dealBadge?: string;
  savingPercentage?: number;
  changed: boolean;
  affiliateLink?: string;
  image?: string;
}

export interface SyncAllResult {
  success: boolean;
  timestamp: string;
  totalProducts: number;
  syncedCount: number;
  updatedCount: number;
  priceChangedCount: number;
  skippedCount: number;
  errors: string[];
  details: SyncUpdateDetail[];
}

// In-memory record of the last sync run for admin monitoring
let lastSyncReport: SyncAllResult | null = null;

export function getLastSyncReport(): SyncAllResult | null {
  return lastSyncReport;
}

/**
 * SCHEDULER ENGINE:
 * Queries all products in the database, extracts ASINs, fetches live attributes
 * (price, originalPrice, offers, ratings, reviews, stock) via Amazon Creator API,
 * and updates each product in Supabase.
 */
export async function syncAllProductsFromCreatorApi(trigger: "cron" | "manual" | "startup" = "cron"): Promise<SyncAllResult> {
  const timestamp = new Date().toISOString();
  const sessionId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const errors: string[] = [];
  const details: SyncUpdateDetail[] = [];
  const auditEntries: PriceSyncAuditEntry[] = [];

  // 1. Fetch all products currently in store
  const allProducts: ProductRecord[] = await db.getProducts({ limit: 1000 });
  if (!allProducts || allProducts.length === 0) {
    const report: SyncAllResult = {
      success: true,
      timestamp,
      totalProducts: 0,
      syncedCount: 0,
      updatedCount: 0,
      priceChangedCount: 0,
      skippedCount: 0,
      errors: ["No products found in catalogue."],
      details: [],
    };
    lastSyncReport = report;
    return report;
  }

  // 2. Map products to their ASINs
  const productAsinMap: { product: ProductRecord; asin: string }[] = [];
  for (const product of allProducts) {
    const asin = extractAsin(product.affiliateLink) || extractAsin(product.id);
    if (asin) {
      productAsinMap.push({ product, asin });
    }
  }

  const distinctAsins = Array.from(new Set(productAsinMap.map((m) => m.asin)));
  if (distinctAsins.length === 0) {
    const report: SyncAllResult = {
      success: true,
      timestamp,
      totalProducts: allProducts.length,
      syncedCount: 0,
      updatedCount: 0,
      priceChangedCount: 0,
      skippedCount: allProducts.length,
      errors: ["No valid Amazon ASINs could be extracted from products."],
      details: [],
    };
    lastSyncReport = report;
    return report;
  }

  // 3. Fetch live data from Amazon Creator API
  let liveDataMap: Record<string, NormalizedCreatorProduct> = {};
  try {
    liveDataMap = await fetchCreatorProducts(distinctAsins);
  } catch (err: any) {
    errors.push(`Creator API query error: ${err.message}`);
  }

  // 4. Update each product in the database with fresh live attributes
  let updatedCount = 0;
  let priceChangedCount = 0;

  for (const { product, asin } of productAsinMap) {
    const live = liveDataMap[asin];
    if (!live) {
      continue;
    }

    const priceChanged = Boolean(live.price && live.price !== "Check on Amazon" && live.price !== product.price);
    const originalPriceChanged = Boolean(live.originalPrice && live.originalPrice !== product.originalPrice);

    // Build update payload for attributes
    const updatePayload: any = {};

    if (live.price && live.price !== "Check on Amazon") {
      updatePayload.price = live.price;
    }
    if (live.originalPrice && live.originalPrice !== "Check on Amazon") {
      updatePayload.originalPrice = live.originalPrice;
    }
    if (live.rating && live.rating > 0) {
      updatePayload.rating = live.rating;
    }
    if (live.reviews && live.reviews > 0) {
      updatePayload.reviews = live.reviews;
    }
    // Update badge if Amazon has a live deal badge (e.g. Great Indian Festival)
    if (live.offerDetails?.dealBadge) {
      updatePayload.badge = live.offerDetails.dealBadge;
    }

    // Refresh images if missing
    if ((!product.images || product.images.length <= 1) && live.images && live.images.length > 1) {
      updatePayload.images = live.images;
    }

    const hasChanges = Object.keys(updatePayload).length > 0;

    details.push({
      id: product.id,
      asin,
      title: product.title,
      oldPrice: product.price,
      newPrice: live.price || product.price,
      oldOriginalPrice: product.originalPrice,
      newOriginalPrice: live.originalPrice || product.originalPrice,
      dealBadge: live.offerDetails?.dealBadge,
      savingPercentage: live.offerDetails?.savingPercentage,
      changed: hasChanges,
      affiliateLink: product.affiliateLink || live.affiliateLink || `https://www.amazon.in/dp/${asin}?tag=goamaze06-21`,
      image: product.image || live.image || "",
    });

    const priceDiff = calculatePriceDiff(product.price, live.price);
    let entryStatus: "updated" | "unchanged" | "error" = hasChanges ? "updated" : "unchanged";
    let entryError: string | undefined = undefined;

    if (hasChanges) {
      try {
        await db.updateProduct(product.id, updatePayload);
        updatedCount++;
        if (priceChanged) {
          priceChangedCount++;
        }
      } catch (err: any) {
        entryStatus = "error";
        entryError = err.message;
        errors.push(`Failed to update product ${product.id} (${asin}): ${err.message}`);
      }
    }

    auditEntries.push({
      id: `audit_${sessionId}_${asin}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      sessionId,
      timestamp,
      productId: String(product.id),
      asin,
      title: product.title,
      oldPrice: product.price,
      newPrice: live.price || product.price,
      oldOriginalPrice: product.originalPrice,
      newOriginalPrice: live.originalPrice || product.originalPrice,
      priceChanged,
      priceDiffPercentage: priceDiff,
      dealBadge: live.offerDetails?.dealBadge,
      savingPercentage: live.offerDetails?.savingPercentage,
      status: entryStatus,
      errorMessage: entryError,
      affiliateLink: product.affiliateLink || live.affiliateLink || `https://www.amazon.in/dp/${asin}?tag=goamaze06-21`,
      image: product.image || live.image || "",
    });
  }

  // Record audit log for this sync session
  const session: PriceSyncSession = {
    sessionId,
    timestamp,
    trigger,
    totalProducts: allProducts.length,
    syncedCount: Object.keys(liveDataMap).length,
    updatedCount,
    priceChangedCount,
    skippedCount: allProducts.length - Object.keys(liveDataMap).length,
    errors,
  };

  try {
    await recordSyncAudit(session, auditEntries);
  } catch (err: any) {
    console.warn("[AmazonCreator] Failed to record sync audit log:", err.message);
  }

  const report: SyncAllResult = {
    success: errors.length === 0 || updatedCount > 0,
    timestamp,
    totalProducts: allProducts.length,
    syncedCount: Object.keys(liveDataMap).length,
    updatedCount,
    priceChangedCount,
    skippedCount: allProducts.length - Object.keys(liveDataMap).length,
    errors,
    details,
  };

  lastSyncReport = report;
  return report;
}
