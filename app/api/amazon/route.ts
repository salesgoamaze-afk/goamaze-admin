import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Amazon Creators API Endpoints
const TOKEN_URL = process.env.AMAZON_TOKEN_URL || "https://api.amazon.co.uk/auth/o2/token";
const SEARCH_API_URL = "https://creatorsapi.amazon/catalog/v1/searchItems";
const GET_ITEMS_API_URL = "https://creatorsapi.amazon/catalog/v1/getItems";

// Default Marketplace & Associates Partner Tag
const DEFAULT_MARKETPLACE = process.env.AMAZON_MARKETPLACE || "www.amazon.in";
const DEFAULT_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || "goamaze06-21";

import { CREATOR_API_RESOURCES, normalizeCreatorItem, getCreatorAccessToken } from "@/lib/amazon-creator";

// Default item metadata resources to request
const DEFAULT_RESOURCES = CREATOR_API_RESOURCES;

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
  // GoAmaze Store Themes
  "festival special - diwali": "HomeAndKitchen",
  "festival special": "HomeAndKitchen",
  "diwali": "HomeAndKitchen",

  "smart kitchen": "HomeAndKitchen",
  "kitchen appliances": "HomeAndKitchen",
  "kitchen": "HomeAndKitchen",

  "aesthetic living": "HomeAndKitchen",
  "home decoration": "HomeAndKitchen",
  "home decor": "HomeAndKitchen",
  "home": "HomeAndKitchen",

  "desk setup": "OfficeProducts",
  "workstation": "OfficeProducts",
  "study & workspace": "OfficeProducts",
  "study and workspace": "OfficeProducts",
  "workspace": "OfficeProducts",

  "cozy wellness": "HomeAndKitchen",
  "lifestyle products": "HealthAndPersonalCare",
  "lifestyle": "HealthAndPersonalCare",
  "wellness": "HealthAndPersonalCare",

  "coffee corner": "HomeAndKitchen",
  "coffee": "HomeAndKitchen",

  // Note: GardenAndOutdoors is invalid in Amazon India; HomeAndKitchen is the valid index covering planters & gardening
  "green living": "HomeAndKitchen",
  "garden": "HomeAndKitchen",
  "gardening": "HomeAndKitchen",
  "plants": "HomeAndKitchen",

  "gaming zone": "VideoGames",
  "gaming": "VideoGames",
  "video games": "VideoGames",

  "study space": "OfficeProducts",
  "study": "OfficeProducts",
  "office": "OfficeProducts",

  "miscellaneous": "All",
  "general": "All",
  "trending": "All",

  // Canonical Categories & Slugs
  "smart home": "HomeAndKitchen",
  "smart-home": "HomeAndKitchen",
  "home & kitchen": "HomeAndKitchen",
  "home-kitchen": "HomeAndKitchen",
  "kitchen-appliances": "HomeAndKitchen",
  "lighting": "HomeAndKitchen",
  "storage & organization": "HomeAndKitchen",
  "storage-organization": "HomeAndKitchen",
  "cleaning tools": "HomeAndKitchen",
  "cleaning-tools": "HomeAndKitchen",
  "computer accessories": "Computers",
  "computer-accessories": "Computers",
  "audio accessories": "Electronics",
  "audio-accessories": "Electronics",
  "mobiles": "Electronics",
  "mobile accessories": "Electronics",
  "mobile-accessories": "Electronics",
  "personal-care": "HealthAndPersonalCare",
  "travel accessories": "LuggageAndBags",
  "travel-accessories": "LuggageAndBags",
  "gifts": "HomeAndKitchen",

  // Apparel & Fashion categories
  "apparel": "Apparel",
  "clothing": "Apparel",
  "fashion": "Apparel",
  "clothes": "Apparel",
  "mens fashion": "Apparel",
  "womens fashion": "Apparel",
  "shoes": "ShoesAndHandbags",
  "shoes and handbags": "ShoesAndHandbags",

  // Other departments
  "food items": "GroceryAndGourmetFoods",
  "food": "GroceryAndGourmetFoods",
  "grocery": "GroceryAndGourmetFoods",
  "gym": "SportsAndOutdoors",
  "fitness": "SportsAndOutdoors",
  "sports": "SportsAndOutdoors",
  "electronics": "Electronics",
  "appliances": "Appliances",
  "beauty": "Beauty",
  "personal care": "HealthAndPersonalCare",
  "health": "HealthAndPersonalCare",
  "books": "Books",
  "computers": "Computers",
  "furniture": "Furniture",
  "jewellery": "Jewellery",
  "jewelry": "Jewellery",
  "luggage": "LuggageAndBags",
  "bags": "LuggageAndBags",
  "toys": "ToysAndGames",
  "toys and games": "ToysAndGames",
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

  // Check alias dictionary first (handles themes like "green living" -> "HomeAndKitchen")
  if (CATEGORY_SEARCH_INDEX_MAP[cleanCategory]) {
    return CATEGORY_SEARCH_INDEX_MAP[cleanCategory];
  }

  // Check if the category itself directly matches a valid search index
  const directMatch = Array.from(VALID_SEARCH_INDICES).find(
    (idx) => idx.toLowerCase() === cleanCategory
  );
  if (directMatch) return directMatch;

  // Fallback to "All" if no specific index matched
  return "All";
}

/**
 * Resolves high-relevance semantic search keywords for categories and themes
 * when the caller leaves keywords blank. Prevents Amazon API from returning
 * irrelevant items (e.g. body lotion for Apparel).
 */
function resolveCategoryDefaultKeywords(category?: string | null, resolvedIndex?: string): string {
  const clean = (category || "").trim().toLowerCase();

  // Curated theme defaults specifically tested against Amazon Creators API
  if (clean.includes("diwali") || clean.includes("festival")) {
    return "diwali decoration lights festive gifts diyas";
  }
  if (clean.includes("smart kitchen") || clean.includes("kitchen")) {
    return "smart kitchen appliances tools organizers gadget";
  }
  if (clean.includes("aesthetic living") || clean.includes("home decor") || clean.includes("home decoration")) {
    return "aesthetic home decor living room modern lamp decoration";
  }
  if (clean.includes("desk setup") || clean.includes("workstation")) {
    return "desk setup workstation ergonomics desk mat organizer stand";
  }
  if (clean.includes("cozy wellness") || clean.includes("wellness")) {
    return "scented candles aromatherapy wellness diffuser relaxation";
  }
  if (clean.includes("coffee corner") || clean.includes("coffee")) {
    return "coffee maker coffee mug frother coffee station accessories";
  }
  if (clean.includes("green living") || clean.includes("plant") || clean.includes("garden")) {
    return "indoor plants planters pots eco friendly garden decor";
  }
  if (clean.includes("gaming zone") || clean.includes("gaming") || clean.includes("video games")) {
    return "gaming setup accessories rgb mechanical keyboard mousepad";
  }
  if (clean.includes("study space") || clean.includes("study")) {
    return "study lamp table organizers bookshelf stationery accessories";
  }
  if (clean.includes("apparel") || clean.includes("clothing") || clean.includes("fashion")) {
    return "clothing apparel fashion wear outfit";
  }
  if (clean.includes("miscellaneous")) {
    return "trending gadgets lifestyle";
  }
  if (clean.includes("gym") || clean.includes("fitness") || clean.includes("sports")) {
    return "gym fitness workout equipment accessories";
  }
  if (clean.includes("food") || clean.includes("grocery")) {
    return "organic gourmet snacks healthy food";
  }
  if (clean.includes("beauty")) {
    return "skincare beauty cosmetics";
  }
  if (clean.includes("shoes")) {
    return "shoes sneakers footwear";
  }

  // Fallbacks by search index
  switch (resolvedIndex) {
    case "Apparel":
      return "clothing apparel fashion wear outfit";
    case "HomeAndKitchen":
      return "home decor kitchen appliances accessories";
    case "OfficeProducts":
      return "office desk workstation stationery";
    case "VideoGames":
      return "gaming accessories gear";
    case "Electronics":
      return "electronics gadgets tech";
    case "Computers":
      return "computer accessories peripherals";
    case "Beauty":
      return "skincare beauty cosmetics";
    case "ShoesAndHandbags":
      return "footwear shoes bags";
    case "SportsAndOutdoors":
      return "sports fitness gym";
    case "All":
    default:
      return clean && clean !== "all" ? clean : "trending gadgets lifestyle";
  }
}

const getAccessToken = getCreatorAccessToken;
const normalizeAmazonItem = normalizeCreatorItem;

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

  // Auto-resolve high-relevance semantic keywords if user didn't specify custom keywords
  let effectiveKeywords = keywords?.trim();
  if (!effectiveKeywords) {
    effectiveKeywords = resolveCategoryDefaultKeywords(category, resolvedSearchIndex);
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