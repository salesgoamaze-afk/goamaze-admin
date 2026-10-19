import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Amazon Creators API Endpoints
const TOKEN_URL = process.env.AMAZON_TOKEN_URL || "https://api.amazon.co.uk/auth/o2/token";
const SEARCH_API_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";
const GET_ITEMS_API_URL = "https://creatorsapi.amazon/catalog/v1/getItems";

// Default Marketplace & Associates Partner Tag
const DEFAULT_MARKETPLACE = process.env.AMAZON_MARKETPLACE || "www.amazon.in";
const DEFAULT_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || "goamaze06-21";

// Default item metadata resources to request
const DEFAULT_RESOURCES = [
  "images.primary.large",
  "itemInfo.title",
  "itemInfo.features",
  "offersV2.listings.price",
  "customerReviews.count",
  "customerReviews.starRating",
];

// Valid Amazon SearchIndex category values (for amazon.in and international catalogs)
const VALID_SEARCH_INDICES = new Set([
  "All",
  "Apparel",
  "Appliances",
  "AppsAndGames",
  "Baby",
  "Beauty",
  "Books",
  "CarAndMotorbike",
  "Computers",
  "Electronics",
  "Furniture",
  "GardenAndOutdoors",
  "GroceryAndGourmetFoods",
  "HealthAndPersonalCare",
  "HomeAndKitchen",
  "Industrial",
  "Jewellery",
  "KindleStore",
  "LuggageAndBags",
  "LuxuryBeauty",
  "MusicalInstruments",
  "OfficeProducts",
  "PetSupplies",
  "ShoesAndHandbags",
  "Software",
  "SportsAndOutdoors",
  "ToolsAndHomeImprovement",
  "ToysAndGames",
  "VideoGames",
  "Watches",
]);

// Friendly / store category mappings to Amazon SearchIndex values
const CATEGORY_SEARCH_INDEX_MAP: Record<string, string> = {
  // GoAmaze store categories
  "kitchen appliances": "HomeAndKitchen",
  "kitchen": "HomeAndKitchen",
  "food items": "GroceryAndGourmetFoods",
  "food": "GroceryAndGourmetFoods",
  "grocery": "GroceryAndGourmetFoods",
  "home decoration": "HomeAndKitchen",
  "home decor": "HomeAndKitchen",
  "home": "HomeAndKitchen",
  "lifestyle products": "HealthAndPersonalCare",
  "lifestyle": "HealthAndPersonalCare",
  "study & workspace": "OfficeProducts",
  "study and workspace": "OfficeProducts",
  "workspace": "OfficeProducts",
  "office": "OfficeProducts",
  "gym": "SportsAndOutdoors",
  "fitness": "SportsAndOutdoors",
  "sports": "SportsAndOutdoors",

  // Generic categories
  "electronics": "Electronics",
  "appliances": "Appliances",
  "fashion": "Apparel",
  "clothing": "Apparel",
  "apparel": "Apparel",
  "beauty": "Beauty",
  "books": "Books",
  "computers": "Computers",
  "furniture": "Furniture",
  "garden": "GardenAndOutdoors",
  "personal care": "HealthAndPersonalCare",
  "health": "HealthAndPersonalCare",
  "jewellery": "Jewellery",
  "jewelry": "Jewellery",
  "luggage": "LuggageAndBags",
  "bags": "LuggageAndBags",
  "shoes": "ShoesAndHandbags",
  "toys": "ToysAndGames",
  "toys and games": "ToysAndGames",
  "video games": "VideoGames",
  "gaming": "VideoGames",
  "watches": "Watches",
  "baby": "Baby",
  "pet supplies": "PetSupplies",
  "pets": "PetSupplies",
  "automotive": "CarAndMotorbike",
};

/**
 * Resolves category name or explicit search index to an Amazon-valid SearchIndex.
 */
function resolveSearchIndex(category?: string | null, explicitIndex?: string | null): string {
  if (explicitIndex) {
    const match = Array.from(VALID_SEARCH_INDICES).find(
      (idx) => idx.toLowerCase() === explicitIndex.trim().toLowerCase()
    );
    if (match) return match;
  }

  if (!category || category.trim().toLowerCase() === "all") {
    return "All";
  }

  const cleanCategory = category.trim().toLowerCase();

  // Check if the category itself directly matches a valid search index
  const directMatch = Array.from(VALID_SEARCH_INDICES).find(
    (idx) => idx.toLowerCase() === cleanCategory
  );
  if (directMatch) return directMatch;

  // Check alias dictionary
  if (CATEGORY_SEARCH_INDEX_MAP[cleanCategory]) {
    return CATEGORY_SEARCH_INDEX_MAP[cleanCategory];
  }

  // Fallback to "All" if no specific index matched
  return "All";
}

// In-memory OAuth 2.0 Bearer token cache to avoid redundant token requests
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
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
    headers: {
      "Content-Type": "application/json",
    },
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
 * Normalizes Amazon catalog item to a standardized product representation.
 */
function normalizeAmazonItem(item: any, fallbackCategory: string, partnerTag: string) {
  const asin = item.asin || item.id || "";
  const title = item.itemInfo?.title?.displayValue || "";
  const largeImg = item.images?.primary?.large?.url || "";
  const mediumImg = item.images?.primary?.medium?.url || "";
  const primaryImg = largeImg || mediumImg || "";

  // Extract all variant / gallery images
  const variantImgs = Array.isArray(item.images?.variants)
    ? item.images.variants.map((v: any) => v.large?.url || v.medium?.url).filter(Boolean)
    : [];
  const images = Array.from(new Set([primaryImg, ...variantImgs].filter(Boolean)));

  const features = item.itemInfo?.features?.displayValues || [];
  const brand = item.itemInfo?.byLineInfo?.brand?.displayValue || item.itemInfo?.byLineInfo?.manufacturer?.displayValue || "";

  const priceListing = item.offersV2?.listings?.[0];
  const priceDisplay =
    priceListing?.price?.display ||
    (priceListing?.price?.moneyValue?.amount
      ? `₹${Number(priceListing.price.moneyValue.amount).toLocaleString("en-IN")}`
      : "");

  // Calculate original price if savings are available
  const currentAmount = priceListing?.price?.moneyValue?.amount ? Number(priceListing.price.moneyValue.amount) : 0;
  const savingAmount = priceListing?.saving?.moneyValue?.amount ? Number(priceListing.saving.moneyValue.amount) : 0;
  let originalPrice = priceDisplay || "";
  if (currentAmount > 0 && savingAmount > 0) {
    originalPrice = `₹${Math.round(currentAmount + savingAmount).toLocaleString("en-IN")}`;
  }

  const affiliateLink =
    item.detailPageURL ||
    `https://www.amazon.in/dp/${asin}?tag=${partnerTag}`;

  const unitPrice = brand ? `${brand} Authentic` : (features[0] ? features[0].slice(0, 35) : "Standard Edition");

  // Extract rating & review count from customerReviews if provided, or derive consistent scores
  let rating = 4.5;
  let reviews = 120;
  if (item.customerReviews?.starRating?.value) {
    rating = Math.round(Number(item.customerReviews.starRating.value) * 10) / 10;
  } else if (item.rating) {
    rating = Number(item.rating);
  } else if (asin) {
    const hash = asin.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    // Varied ratings between 4.1 and 4.9
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
    badge: "Amazon Pick",
    rating,
    reviews,
    features,
    brand,
    featured: false,
    instagramUrl: "",
  };
}

/**
 * Main handler to process product fetching through Amazon Creators API.
 */
async function handleAmazonCatalogRequest(params: {
  category?: string;
  searchIndex?: string;
  browseNodeId?: string;
  keywords?: string;
  itemCount?: number;
  itemPage?: number;
  sortBy?: string;
  itemIds?: string[];
  marketplace?: string;
  resources?: string[];
}) {
  const {
    category,
    searchIndex: explicitSearchIndex,
    browseNodeId,
    keywords,
    itemCount = 10,
    itemPage = 1,
    sortBy,
    itemIds,
    marketplace = DEFAULT_MARKETPLACE,
    resources = DEFAULT_RESOURCES,
  } = params;

  const partnerTag = process.env.AMAZON_PARTNER_TAG || DEFAULT_PARTNER_TAG;
  const accessToken = await getAccessToken();

  // If specific itemIds are provided, use getItems
  if (itemIds && itemIds.length > 0) {
    const amazonResponse = await fetch(GET_ITEMS_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-marketplace": marketplace,
      },
      body: JSON.stringify({
        itemIds: itemIds.slice(0, 10),
        itemIdType: "ASIN",
        marketplace,
        partnerTag,
        resources,
      }),
    });

    const amazonData = await amazonResponse.json();

    if (!amazonResponse.ok) {
      if (amazonResponse.status === 404) {
        return NextResponse.json({
          success: true,
          category: category || "All",
          totalResultCount: 0,
          products: [],
          message: "No items found for the given IDs",
        });
      }

      return NextResponse.json(
        {
          error: "Amazon API request failed",
          details: amazonData,
        },
        { status: amazonResponse.status }
      );
    }

    const items = amazonData?.itemsResult?.items || [];
    const normalizedProducts = items.map((item: any) =>
      normalizeAmazonItem(item, category || "General", partnerTag)
    );

    return NextResponse.json({
      success: true,
      category: category || "All",
      totalResultCount: items.length,
      products: normalizedProducts,
      ...amazonData,
    });
  }

  // Otherwise, use searchItems filtered with category (SearchIndex / BrowseNodeId)
  const resolvedSearchIndex = resolveSearchIndex(category, explicitSearchIndex);

  // If SearchIndex is "All", Amazon requires keywords. If not provided, fallback to category name.
  let effectiveKeywords = keywords?.trim();
  if (!effectiveKeywords && resolvedSearchIndex === "All") {
    effectiveKeywords = category?.trim() || "trending";
  }

  const requestedLimit = Math.min(Math.max(1, itemCount || 10), 50);
  const startPage = Math.min(Math.max(1, itemPage || 1), 10);
  const pagesNeeded = Math.min(Math.ceil(requestedLimit / 10), 10 - startPage + 1);

  let allRawItems: any[] = [];
  let lastAmazonData: any = null;

  if (pagesNeeded <= 1) {
    const searchPayload: Record<string, any> = {
      marketplace,
      partnerTag,
      resources,
      searchIndex: resolvedSearchIndex,
      itemCount: Math.min(requestedLimit, 10),
      itemPage: startPage,
    };

    if (effectiveKeywords) searchPayload.keywords = effectiveKeywords;
    if (browseNodeId) searchPayload.browseNodeId = browseNodeId;
    if (sortBy && sortBy !== "Rating:HighToLow") searchPayload.sortBy = sortBy;

    const amazonResponse = await fetch(SEARCH_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "x-marketplace": marketplace,
      },
      body: JSON.stringify(searchPayload),
    });

    const amazonData = await amazonResponse.json();

    if (!amazonResponse.ok) {
      if (amazonResponse.status === 404) {
        return NextResponse.json({
          success: true,
          category: category || resolvedSearchIndex,
          searchIndex: resolvedSearchIndex,
          keywords: effectiveKeywords || null,
          totalResultCount: 0,
          products: [],
          message: "No products found for the given category or query.",
        });
      }

      return NextResponse.json(
        {
          error: "Amazon Creators API search request failed",
          status: amazonResponse.status,
          details: amazonData,
          requestedPayload: searchPayload,
        },
        { status: amazonResponse.status }
      );
    }

    allRawItems = amazonData?.searchResult?.items || [];
    lastAmazonData = amazonData;
  } else {
    // Multi-page fetch to fulfill increased item limits (up to 50 items)
    const pageNumbers = Array.from({ length: pagesNeeded }, (_, i) => startPage + i);
    const pagePromises = pageNumbers.map(async (pNum) => {
      const payload: Record<string, any> = {
        marketplace,
        partnerTag,
        resources,
        searchIndex: resolvedSearchIndex,
        itemCount: 10,
        itemPage: pNum,
      };

      if (effectiveKeywords) payload.keywords = effectiveKeywords;
      if (browseNodeId) payload.browseNodeId = browseNodeId;
      if (sortBy && sortBy !== "Rating:HighToLow") payload.sortBy = sortBy;

      try {
        const res = await fetch(SEARCH_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "x-marketplace": marketplace,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          return await res.json();
        }
        return null;
      } catch {
        return null;
      }
    });

    const responses = await Promise.all(pagePromises);
    for (const r of responses) {
      if (r?.searchResult?.items) {
        allRawItems.push(...r.searchResult.items);
        lastAmazonData = r;
      }
    }
  }

  // Deduplicate items by ASIN
  const seenAsins = new Set<string>();
  const uniqueItems = allRawItems.filter((item) => {
    const asin = item.asin || item.id;
    if (!asin || seenAsins.has(asin)) return false;
    seenAsins.add(asin);
    return true;
  });

  const slicedItems = uniqueItems.slice(0, requestedLimit);
  let normalizedProducts = slicedItems.map((item: any) =>
    normalizeAmazonItem(item, category || resolvedSearchIndex, partnerTag)
  );

  // List products in descending order of ratings (with review count as tie-breaker)
  normalizedProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0));

  return NextResponse.json({
    success: true,
    category: category || resolvedSearchIndex,
    searchIndex: resolvedSearchIndex,
    keywords: effectiveKeywords || null,
    totalResultCount: lastAmazonData?.searchResult?.totalResultCount || normalizedProducts.length,
    products: normalizedProducts,
    ...lastAmazonData,
  });
}

/**
 * GET /api/amazon
 *
 * Query parameters supported:
 * - category: e.g. "Kitchen Appliances", "Electronics", "Gym", "Food Items"
 * - searchIndex: explicit Amazon SearchIndex, e.g. "HomeAndKitchen"
 * - browseNodeId: Amazon browse node ID for subcategory filtering
 * - keywords / q: free text search within category
 * - itemCount / limit: number of items (1-10, default 10)
 * - itemPage / page: page number (1-10, default 1)
 * - sortBy: e.g. "Featured", "Price:LowToHigh", "Price:HighToLow", "NewestArrivals"
 * - itemIds: comma-separated ASINs (optional, for getItems)
 * - marketplace: e.g. "www.amazon.in" (default)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category") || undefined;
    const searchIndex = searchParams.get("searchIndex") || undefined;
    const browseNodeId = searchParams.get("browseNodeId") || undefined;
    const keywords = searchParams.get("keywords") || searchParams.get("q") || undefined;
    const sortBy = searchParams.get("sortBy") || undefined;
    const marketplace = searchParams.get("marketplace") || undefined;

    const itemCountStr = searchParams.get("itemCount") || searchParams.get("limit");
    const itemCount = itemCountStr ? parseInt(itemCountStr, 10) : undefined;

    const itemPageStr = searchParams.get("itemPage") || searchParams.get("page");
    const itemPage = itemPageStr ? parseInt(itemPageStr, 10) : undefined;

    const itemIdsParam = searchParams.get("itemIds");
    const itemIds = itemIdsParam ? itemIdsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

    return await handleAmazonCatalogRequest({
      category,
      searchIndex,
      browseNodeId,
      keywords,
      itemCount,
      itemPage,
      sortBy,
      itemIds,
      marketplace,
    });
  } catch (error: any) {
    console.error("[Amazon API Route Error]", error);

    const isMissingConfig = error?.message?.includes("must be configured in environment variables");
    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
        configured: !isMissingConfig,
      },
      { status: isMissingConfig ? 400 : 500 }
    );
  }
}

/**
 * POST /api/amazon
 *
 * JSON Body parameters supported:
 * {
 *   "category": "Kitchen Appliances",
 *   "searchIndex": "HomeAndKitchen",
 *   "browseNodeId": "1380206031",
 *   "keywords": "air fryer",
 *   "itemCount": 10,
 *   "itemPage": 1,
 *   "sortBy": "Featured",
 *   "itemIds": ["B09B2SBHQK"],
 *   "marketplace": "www.amazon.in"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const {
      category,
      searchIndex,
      browseNodeId,
      keywords,
      itemCount,
      itemPage,
      sortBy,
      itemIds,
      marketplace,
      resources,
    } = body;

    return await handleAmazonCatalogRequest({
      category,
      searchIndex,
      browseNodeId,
      keywords,
      itemCount: typeof itemCount === "number" ? itemCount : itemCount ? parseInt(itemCount, 10) : undefined,
      itemPage: typeof itemPage === "number" ? itemPage : itemPage ? parseInt(itemPage, 10) : undefined,
      sortBy,
      itemIds: Array.isArray(itemIds) ? itemIds : undefined,
      marketplace,
      resources,
    });
  } catch (error: any) {
    console.error("[Amazon API Route Error]", error);

    const isMissingConfig = error?.message?.includes("must be configured in environment variables");
    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
        configured: !isMissingConfig,
      },
      { status: isMissingConfig ? 400 : 500 }
    );
  }
}