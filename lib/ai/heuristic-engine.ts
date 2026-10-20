import {
  NormalizedCreatorProduct,
} from "@/lib/amazon-creator";
import {
  ProductAIAnalysis,
  ScoreBreakdown,
  ScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
  CategoryAnalysisResult,
  RecommendationAward,
  ConfidenceLevel,
} from "./types";

/**
 * Extracts a numeric price from a string like "₹1,889", "₹ 2,499.00", or "$29.99".
 */
export function extractNumericPrice(priceStr?: string | null): number {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/**
 * Theme keywords dictionary for semantic category relevance scoring.
 */
const THEME_KEYWORDS: Record<string, string[]> = {
  "smart kitchen": ["kitchen", "cook", "appliance", "fryer", "blender", "chopper", "food", "cooker", "utensil", "knife", "organizer", "smart", "pan", "pot", "oven", "scale", "grill"],
  "kitchen appliances": ["kitchen", "cook", "appliance", "fryer", "blender", "chopper", "cooker", "oven", "toaster", "kettle"],
  "aesthetic living": ["aesthetic", "decor", "home", "living", "room", "lamp", "vase", "sculpture", "minimalist", "luxury", "wooden", "wall", "cushion", "curtain", "candle", "art", "ceramic"],
  "desk setup": ["desk", "setup", "workstation", "stand", "monitor", "laptop", "ergonomic", "keyboard", "mouse", "mat", "cable", "riser", "office", "arm", "hub", "dock"],
  "cozy wellness": ["wellness", "candle", "diffuser", "aroma", "essential", "oil", "humidifier", "relaxation", "massage", "bath", "sleep", "cozy", "scented", "meditation"],
  "coffee corner": ["coffee", "espresso", "frother", "maker", "mug", "grinder", "pour", "over", "kettle", "barista", "brewing", "dripper", "station"],
  "green living": ["plant", "planter", "pot", "indoor", "garden", "green", "eco", "succulent", "ceramic", "air", "purifying", "gardening"],
  "gaming zone": ["gaming", "game", "rgb", "mechanical", "keyboard", "mouse", "headset", "mousepad", "console", "cooling", "chair", "lighting"],
  "study space": ["study", "student", "book", "bookshelf", "lamp", "table", "stationery", "organizer", "notebook", "pen", "reading", "pencil"],
  "festival special - diwali": ["diwali", "festive", "diya", "diyas", "light", "lantern", "decoration", "candle", "puja", "brass", "rangoli", "gift"],
  "apparel": ["apparel", "clothing", "wear", "shirt", "t-shirt", "dress", "fashion", "fabric", "cotton", "jacket", "pants", "style"],
};

/**
 * Bayesian rating smoothing:
 * Shrinks small-sample ratings toward the category average to prevent a 5.0 with 2 reviews
 * from outranking a 4.7 with 5,000 reviews.
 */
export function calculateBayesianRatingScore(
  rawRating: number,
  reviewCount: number,
  priorThreshold: number = 50,
  categoryMean: number = 4.2
): number {
  const v = Math.max(0, reviewCount);
  const R = Math.max(1, Math.min(5, rawRating));
  const m = priorThreshold;
  const C = categoryMean;

  const smoothedRating = (v * R + m * C) / (v + m);

  // Map 3.0 - 5.0 to 0 - 100
  // e.g. 5.0 -> 100, 4.5 -> 88, 4.0 -> 72, 3.5 -> 50, 3.0 -> 25, <3.0 -> 10
  if (smoothedRating >= 4.8) return Math.min(100, Math.round(92 + (smoothedRating - 4.8) * 40));
  if (smoothedRating >= 4.4) return Math.round(82 + (smoothedRating - 4.4) * 25);
  if (smoothedRating >= 4.0) return Math.round(70 + (smoothedRating - 4.0) * 30);
  if (smoothedRating >= 3.5) return Math.round(50 + (smoothedRating - 3.5) * 40);
  return Math.max(15, Math.round(smoothedRating * 14));
}

/**
 * Evaluates feature depth, build quality indicators, and specification completeness.
 */
export function calculateQualityScore(product: NormalizedCreatorProduct): number {
  let score = 50; // base

  const text = `${product.title} ${product.description || ""} ${product.features.join(" ")}`.toLowerCase();

  // Premium / durable materials signals
  const qualitySignals = [
    "stainless steel", "aluminum", "aluminium", "copper", "brass", "solid wood",
    "bamboo", "tempered glass", "ceramic", "bpa free", "heavy duty", "durable",
    "ergonomic", "high density", "anti-slip", "waterproof", "scratch resistant",
    "isi certified", "ce certified", "warranty", "year warranty", "guarantee",
    "precision", "artisan", "handmade", "smart", "automatic", "rechargeable"
  ];

  let matches = 0;
  for (const signal of qualitySignals) {
    if (text.includes(signal)) {
      matches++;
      score += 3;
    }
  }

  // Feature list richness
  const featureCount = product.features.length;
  if (featureCount >= 5) score += 12;
  else if (featureCount >= 3) score += 8;
  else if (featureCount >= 1) score += 4;
  else score -= 10;

  // Brand signal
  if (product.brand && product.brand.trim() && product.brand !== "Generic") {
    score += 6;
  }

  // Multi-image verification
  if (product.images && product.images.length >= 3) {
    score += 4;
  }

  return Math.min(98, Math.max(25, score));
}

/**
 * Evaluates value for money by comparing product price against the group median
 * and factoring in savings percentage and feature count.
 */
export function calculateValueForMoneyScore(
  product: NormalizedCreatorProduct,
  groupMedianPrice: number
): number {
  const currentPrice = extractNumericPrice(product.price);
  const origPrice = extractNumericPrice(product.originalPrice);

  if (currentPrice <= 0) {
    return 55; // Unknown price default
  }

  let score = 70; // baseline

  // Savings / Discount benefit
  if (origPrice > currentPrice) {
    const discountRatio = (origPrice - currentPrice) / origPrice;
    if (discountRatio >= 0.4) score += 15;
    else if (discountRatio >= 0.2) score += 10;
    else if (discountRatio >= 0.05) score += 5;
  }

  // Price competitiveness against peer median in category
  if (groupMedianPrice > 0) {
    const ratio = currentPrice / groupMedianPrice;
    if (ratio >= 0.4 && ratio <= 0.85) {
      // Sweet spot: 15-60% cheaper than median with good features
      score += 12;
    } else if (ratio < 0.4) {
      // Extremely cheap: good value, but check quality
      score += 8;
    } else if (ratio > 1.8) {
      // High premium: requires outstanding features to justify
      score -= 10;
    } else if (ratio > 1.3) {
      score -= 5;
    }
  }

  // Feature value bonus
  if (product.features.length >= 4) {
    score += 5;
  }

  return Math.min(99, Math.max(30, score));
}

/**
 * Evaluates semantic fit for the category or storefront theme.
 */
export function calculateCategoryRelevanceScore(
  product: NormalizedCreatorProduct,
  category: string
): number {
  const cleanCat = category.toLowerCase().trim();
  const text = `${product.title} ${product.subtitle || ""} ${product.description || ""} ${product.category || ""} ${product.features.join(" ")}`.toLowerCase();

  // Find matching keyword list
  let keywords = THEME_KEYWORDS[cleanCat];
  if (!keywords) {
    // Try substring matching
    const matchingKey = Object.keys(THEME_KEYWORDS).find((k) => cleanCat.includes(k) || k.includes(cleanCat));
    keywords = matchingKey ? THEME_KEYWORDS[matchingKey] : [cleanCat];
  }

  let matchedCount = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) {
      matchedCount++;
    }
  }

  const keywordRatio = Math.min(1, matchedCount / Math.min(6, keywords.length));
  let score = Math.round(55 + keywordRatio * 43);

  // Exact category name match bonus
  if (text.includes(cleanCat)) {
    score = Math.min(98, score + 6);
  }

  return Math.max(35, score);
}

/**
 * Evaluates popularity and demand using review counts and deal tags,
 * without falsely claiming "bestseller" without authorized evidence.
 */
export function calculatePopularityScore(product: NormalizedCreatorProduct): number {
  const reviews = Math.max(0, product.reviews || 0);

  let score = 40;
  if (reviews >= 10000) score = 96;
  else if (reviews >= 5000) score = 92;
  else if (reviews >= 2000) score = 88;
  else if (reviews >= 1000) score = 84;
  else if (reviews >= 500) score = 78;
  else if (reviews >= 200) score = 72;
  else if (reviews >= 50) score = 64;
  else if (reviews >= 15) score = 52;
  else score = 38;

  // Deal badge bonus
  if (product.badge && product.badge.toLowerCase().includes("deal")) {
    score = Math.min(98, score + 4);
  }

  return score;
}

/**
 * Extracts factual pros and cons based strictly on verified product attributes.
 */
export function extractEvidenceBasedProsCons(product: NormalizedCreatorProduct): {
  pros: string[];
  cons: string[];
} {
  const pros: string[] = [];
  const cons: string[] = [];

  const priceNum = extractNumericPrice(product.price);
  const origPriceNum = extractNumericPrice(product.originalPrice);
  const discountPercent = origPriceNum > priceNum ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100) : 0;

  // PROS
  // 1. Rating & Reviews
  if (product.rating >= 4.5 && product.reviews >= 200) {
    pros.push(`Exceptional ${product.rating.toFixed(1)}★ rating with strong customer validation (${product.reviews.toLocaleString("en-IN")} reviews)`);
  } else if (product.rating >= 4.2 && product.reviews >= 50) {
    pros.push(`Consistently positive customer feedback (${product.rating.toFixed(1)}★ average)`);
  }

  // 2. Pricing & Value
  if (discountPercent >= 25) {
    pros.push(`Attractive ${discountPercent}% price discount from listed M.R.P.`);
  } else if (product.price && product.price !== "Check on Amazon") {
    pros.push(`Competitive pricing at ${product.price}`);
  }

  // 3. Features & Specifications
  if (product.features && product.features.length > 0) {
    // Pick the most descriptive and factual feature lines
    const cleanFeatures = product.features
      .filter((f) => f && f.length >= 12 && f.length <= 110)
      .slice(0, 2);
    cleanFeatures.forEach((f) => pros.push(f));
  }

  // 4. Brand presence
  if (product.brand && product.brand !== "Generic") {
    pros.push(`Authentic offering from reputable brand ${product.brand}`);
  }

  // CONS / Limitations
  // 1. Missing or low reviews
  if (product.reviews < 25) {
    cons.push("Limited customer review volume available to evaluate long-term durability");
  }

  // 2. Missing price
  if (!product.price || product.price === "Check on Amazon") {
    cons.push("Real-time pricing must be checked directly on Amazon");
  }

  // 3. Lower rating caution
  if (product.rating < 4.0) {
    cons.push(`Average rating is ${product.rating.toFixed(1)}★; customer satisfaction is mixed`);
  }

  // 4. Feature brevity
  if (!product.features || product.features.length < 2) {
    cons.push("Basic specifications provided; verify dimensions and variant options");
  }

  // 5. High-price caveat
  if (priceNum > 5000) {
    cons.push("Higher upfront investment compared to entry-level alternatives");
  }

  // Ensure at least 2 pros and 1 con
  if (pros.length < 2) {
    pros.push("Direct fulfillment and customer support backed by Amazon");
  }
  if (cons.length === 0) {
    cons.push("Subject to stock availability and seasonal seller price variations");
  }

  return {
    pros: pros.slice(0, 3),
    cons: cons.slice(0, 2),
  };
}

/**
 * Determines a concise "Best For" tag based on category and specifications.
 */
export function generateBestForTag(
  product: NormalizedCreatorProduct,
  category: string,
  award?: RecommendationAward
): string {
  if (award === "Best Overall") return "Best Overall Choice";
  if (award === "Best Value for Money") return "Best Value for Money";
  if (award === "Best Budget Pick") return "Best Budget Option";
  if (award === "Premium Choice") return "Best for Discerning Users";

  const titleLower = product.title.toLowerCase();
  const catLower = category.toLowerCase();

  if (catLower.includes("kitchen")) {
    if (titleLower.includes("air fryer") || titleLower.includes("oven")) return "Best for Quick Healthy Meals";
    if (titleLower.includes("blender") || titleLower.includes("mixer")) return "Best for Smoothies & Prep";
    if (titleLower.includes("container") || titleLower.includes("organizer")) return "Best for Kitchen Organization";
    return "Best for Modern Kitchens";
  }

  if (catLower.includes("desk") || catLower.includes("workstation")) {
    if (titleLower.includes("ergonomic") || titleLower.includes("stand")) return "Best for Ergonomic Workspaces";
    if (titleLower.includes("mat") || titleLower.includes("pad")) return "Best for Minimalist Desks";
    if (titleLower.includes("cable") || titleLower.includes("organizer")) return "Best for Cable Cleanliness";
    return "Best for Daily Workstations";
  }

  if (catLower.includes("wellness")) {
    if (titleLower.includes("candle") || titleLower.includes("scent")) return "Best for Evening Relaxation";
    if (titleLower.includes("diffuser") || titleLower.includes("humidifier")) return "Best for Aromatherapy & Air";
    return "Best for Self-Care & Calm";
  }

  if (catLower.includes("aesthetic") || catLower.includes("decor")) {
    return "Best for Living Room Accents";
  }

  if (catLower.includes("coffee")) {
    if (titleLower.includes("frother")) return "Best for Café-Style Milk Foam";
    if (titleLower.includes("pour over") || titleLower.includes("dripper")) return "Best for Artisanal Brewing";
    return "Best for Coffee Lovers";
  }

  return `Best for ${category} Enthusiasts`;
}

/**
 * Main Deterministic / Heuristic Analysis Pipeline.
 * Evaluates an entire array of products, computes median prices, scores each dimension,
 * ranks products, assigns awards, and prepares transparent evidence explanations.
 */
export function analyzeProductsHeuristic(
  category: string,
  products: NormalizedCreatorProduct[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): CategoryAnalysisResult {
  const startTime = Date.now();

  if (!products || products.length === 0) {
    return {
      category,
      totalProducts: 0,
      rankedProducts: [],
      providerUsed: "Heuristic Scorer (Local Engine)",
      modelUsed: "Rule-Based Deterministic v1.2",
      executionTimeMs: 0,
      timestamp: new Date().toISOString(),
      weightsUsed: weights,
    };
  }

  // Calculate peer group median price for value evaluation
  const validPrices = products
    .map((p) => extractNumericPrice(p.price))
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  const medianPrice = validPrices.length > 0 ? validPrices[Math.floor(validPrices.length / 2)] : 0;

  // Step 1: Score each product individually
  const scoredItems: Array<{
    product: NormalizedCreatorProduct;
    breakdown: ScoreBreakdown;
    overallScore: number;
    dataQualityFlags: string[];
    confidenceLevel: ConfidenceLevel;
    pros: string[];
    cons: string[];
  }> = products.map((product) => {
    const satisfaction = calculateBayesianRatingScore(product.rating, product.reviews);
    const quality = calculateQualityScore(product);
    const value = calculateValueForMoneyScore(product, medianPrice);
    const relevance = calculateCategoryRelevanceScore(product, category);
    const popularity = calculatePopularityScore(product);

    const breakdown: ScoreBreakdown = {
      customerSatisfaction: satisfaction,
      productQuality: quality,
      valueForMoney: value,
      categoryRelevance: relevance,
      popularity: popularity,
    };

    // Normalized weighted composite score (0 - 100)
    const composite =
      breakdown.customerSatisfaction * weights.customerSatisfaction +
      breakdown.productQuality * weights.productQuality +
      breakdown.valueForMoney * weights.valueForMoney +
      breakdown.categoryRelevance * weights.categoryRelevance +
      breakdown.popularity * weights.popularity;

    const overallScore = Math.min(99, Math.max(30, Math.round(composite)));

    // Data quality assessment
    const flags: string[] = [];
    if (!product.price || product.price === "Check on Amazon") {
      flags.push("Price currently unavailable via API");
    }
    if ((product.reviews || 0) < 20) {
      flags.push("Low review count (< 20 reviews)");
    }
    if (!product.features || product.features.length === 0) {
      flags.push("Sparse feature specifications");
    }

    let confidenceLevel: ConfidenceLevel = "high";
    if (flags.length >= 2) confidenceLevel = "low";
    else if (flags.length === 1) confidenceLevel = "medium";

    const { pros, cons } = extractEvidenceBasedProsCons(product);

    return {
      product,
      breakdown,
      overallScore,
      dataQualityFlags: flags,
      confidenceLevel,
      pros,
      cons,
    };
  });

  // Step 2: Sort descending by overall score (with satisfaction and review count as tie-breakers)
  scoredItems.sort((a, b) => {
    if (b.overallScore !== a.overallScore) {
      return b.overallScore - a.overallScore;
    }
    if (b.breakdown.customerSatisfaction !== a.breakdown.customerSatisfaction) {
      return b.breakdown.customerSatisfaction - a.breakdown.customerSatisfaction;
    }
    return (b.product.reviews || 0) - (a.product.reviews || 0);
  });

  // Step 3: Identify Key Award Winners
  // Best Overall: #1 scored item with high or medium confidence
  const bestOverallItem = scoredItems.find((item) => item.confidenceLevel !== "low") || scoredItems[0];

  // Best Value for Money: Top value score with rating >= 4.0
  const bestValueItem = scoredItems
    .filter((item) => item.product.rating >= 4.0 && item.confidenceLevel !== "low")
    .sort((a, b) => b.breakdown.valueForMoney - a.breakdown.valueForMoney)[0];

  // Best Budget: Lowest price in top 50% of scored items with rating >= 4.0
  const topHalf = scoredItems.slice(0, Math.max(2, Math.ceil(scoredItems.length / 2)));
  const budgetCandidates = topHalf
    .filter((item) => {
      const p = extractNumericPrice(item.product.price);
      return p > 0 && item.product.rating >= 3.9;
    })
    .sort((a, b) => extractNumericPrice(a.product.price) - extractNumericPrice(b.product.price));
  const bestBudgetItem = budgetCandidates[0];

  // Step 4: Construct the final ranked product records
  const now = new Date().toISOString();
  const rankedProducts: ProductAIAnalysis[] = scoredItems.map((item, index) => {
    const rank = index + 1;
    let award: RecommendationAward | undefined;
    let awardBadgeColor = "rgba(255,255,255,0.08)";

    if (item.product.asin === bestOverallItem?.product.asin) {
      award = "Best Overall";
      awardBadgeColor = "rgba(234, 179, 8, 0.25)"; // Gold
    } else if (bestValueItem && item.product.asin === bestValueItem.product.asin) {
      award = "Best Value for Money";
      awardBadgeColor = "rgba(34, 197, 94, 0.25)"; // Green
    } else if (bestBudgetItem && item.product.asin === bestBudgetItem.product.asin && bestBudgetItem !== bestOverallItem) {
      award = "Best Budget Pick";
      awardBadgeColor = "rgba(59, 130, 246, 0.25)"; // Blue
    } else if (item.breakdown.productQuality >= 88 && rank <= 4) {
      award = "Premium Choice";
      awardBadgeColor = "rgba(168, 85, 247, 0.25)"; // Purple
    } else if (rank <= 3) {
      award = "Editor's Top Recommendation";
      awardBadgeColor = "rgba(249, 115, 22, 0.25)"; // Orange
    }

    const bestFor = generateBestForTag(item.product, category, award);

    // AI summary sentence
    const priceContext = item.product.price && item.product.price !== "Check on Amazon" ? `priced at ${item.product.price}` : "available on Amazon";
    const ratingContext = item.product.rating ? `earns a ${item.product.rating.toFixed(1)}★ rating from ${item.product.reviews?.toLocaleString("en-IN") || 0} buyers` : "features positive buyer signals";
    const aiSummary = `${item.product.title} ${priceContext} is tailored as ${bestFor.toLowerCase()}. It ${ratingContext} with strong specifications for ${category.toLowerCase()}.`;

    // Transparent reason
    const recommendationReason = `Ranks #${rank} with an overall score of ${item.overallScore}/100 based on ${item.breakdown.customerSatisfaction}/100 customer satisfaction, ${item.breakdown.productQuality}/100 build quality, and ${item.breakdown.valueForMoney}/100 value-for-money.`;

    return {
      asin: item.product.asin,
      id: item.product.id,
      title: item.product.title,
      price: item.product.price,
      originalPrice: item.product.originalPrice,
      image: item.product.image,
      images: item.product.images || (item.product.image ? [item.product.image] : []),
      affiliateLink: item.product.affiliateLink,
      category: item.product.category || category,
      rating: item.product.rating,
      reviews: item.product.reviews,
      brand: item.product.brand,
      features: item.product.features || [],

      overallScore: item.overallScore,
      rank,
      award,
      awardBadgeColor,
      scoreBreakdown: item.breakdown,
      aiSummary,
      pros: item.pros,
      cons: item.cons,
      bestFor,
      recommendationReason,
      targetAudience: `Ideal for users searching for high-quality ${category.toLowerCase()} with proven customer satisfaction.`,
      confidenceLevel: item.confidenceLevel,
      dataQualityFlags: item.dataQualityFlags,
      curationStatus: "pending",
      lastAnalyzedAt: now,
    };
  });

  const duration = Date.now() - startTime;

  return {
    category,
    totalProducts: rankedProducts.length,
    bestOverall: rankedProducts.find((p) => p.award === "Best Overall") || rankedProducts[0],
    bestValue: rankedProducts.find((p) => p.award === "Best Value for Money"),
    bestBudget: rankedProducts.find((p) => p.award === "Best Budget Pick"),
    rankedProducts,
    providerUsed: "Heuristic Scorer (Deterministic Engine)",
    modelUsed: "Rule-Based Deterministic v1.2",
    executionTimeMs: duration,
    timestamp: now,
    weightsUsed: weights,
  };
}
