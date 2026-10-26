import { NextRequest, NextResponse } from "next/server";
import { analyzeCategoryProducts } from "@/lib/ai";
import { fetchCreatorProducts, NormalizedCreatorProduct, extractAsin } from "@/lib/amazon-creator";
import { recommendationsStore } from "@/lib/recommendations-store";
import { classifyProductHeuristic } from "@/lib/ai/classifier";
import { CANONICAL_CATEGORIES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/analyze
 *
 * Request body options:
 * 1. Direct products analysis:
 *    { "category": "Smart Kitchen", "products": [...], "weights": {...}, "provider": "gemini", "forceFresh": false }
 *
 * 2. Auto-fetch from Amazon + analyze:
 *    { "category": "Smart Kitchen", "keywords": "air fryer", "limit": 20, "weights": {...}, "provider": "gemini" }
 *
 * 3. Specific ASINs fetch + analyze:
 *    { "category": "Smart Kitchen", "asins": ["B09B2SBHQK", ...], "weights": {...} }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      category = "General",
      products: providedProducts,
      asins,
      keywords,
      limit = 20,
      weights,
      provider,
      forceFresh = false,
      saveBatch = true,
    } = body;

    let targetProducts: NormalizedCreatorProduct[] = [];

    if (Array.isArray(providedProducts) && providedProducts.length > 0) {
      targetProducts = providedProducts;
    } else if (Array.isArray(asins) && asins.length > 0) {
      const cleanAsins = asins.map((a: string) => extractAsin(a)).filter(Boolean) as string[];
      if (cleanAsins.length === 0) {
        return NextResponse.json(
          { success: false, error: "No valid ASINs provided." },
          { status: 400 }
        );
      }
      const fetchedMap = await fetchCreatorProducts(cleanAsins);
      targetProducts = Object.values(fetchedMap);
    } else {
      // Auto-fetch via internal call to /api/amazon
      const baseUrl = req.nextUrl.origin;
      const queryParams = new URLSearchParams();
      queryParams.set("category", category);
      if (keywords) queryParams.set("keywords", keywords);
      queryParams.set("limit", String(Math.min(50, Math.max(5, limit))));

      const amazonRes = await fetch(`${baseUrl}/api/amazon?${queryParams.toString()}`, {
        cache: "no-store",
      });

      if (!amazonRes.ok) {
        const errorData = await amazonRes.json().catch(() => ({}));
        return NextResponse.json(
          {
            success: false,
            error: errorData.error || "Failed to fetch products from Amazon Creators API.",
            details: errorData,
          },
          { status: amazonRes.status }
        );
      }

      const amazonData = await amazonRes.json();
      targetProducts = amazonData.products || [];
    }

    if (targetProducts.length === 0) {
      return NextResponse.json({
        success: true,
        category,
        totalProducts: 0,
        rankedProducts: [],
        message: "No products available to analyze for the specified criteria.",
      });
    }

    // Run AI analysis and multi-criteria ranking
    const analysisResult = await analyzeCategoryProducts(category, targetProducts, {
      weights,
      provider: provider || "heuristic",
      forceFresh,
    });

    // Enrich ranked products with heuristic taxonomy classification & badge recommendations
    const enrichedRankedProducts = analysisResult.rankedProducts.map((rp) => {
      const cls = classifyProductHeuristic({
        title: rp.title,
        brand: rp.brand,
        description: rp.aiSummary || (rp as any).description || "",
        features: rp.features || [],
        price: rp.price,
        categoryHint: category,
      });

      const suggestedCategories = cls.categories.map((c) => c.slug);
      const suggestedThemes = cls.themes.map((t) => t.slug);

      // Match subcategories from canonical categories based on title & features
      const matchedSubcategories: string[] = [];
      const textToMatch = `${rp.title} ${(rp.features || []).join(" ")}`.toLowerCase();
      for (const catSlug of suggestedCategories) {
        const cat = CANONICAL_CATEGORIES.find((c) => c.slug === catSlug);
        if (cat && Array.isArray(cat.subcategories)) {
          for (const sub of cat.subcategories) {
            const subTokens = sub.toLowerCase().split(/[\s&,/]+/);
            if (subTokens.some((tok) => tok.length > 3 && textToMatch.includes(tok))) {
              matchedSubcategories.push(sub);
            }
          }
        }
      }

      // Map primary suggested category slug to canonical display name
      const primaryCatSlug = suggestedCategories[0];
      const matchedCatDef = CANONICAL_CATEGORIES.find((c) => c.slug === primaryCatSlug);
      const suggestedCategoryName = matchedCatDef ? matchedCatDef.name : rp.category;

      // Suggest appropriate storefront badge based on award
      let suggestedBadge = "Amazon Pick";
      if (rp.award === "Best Overall") suggestedBadge = "Best Seller";
      else if (rp.award === "Best Value for Money") suggestedBadge = "Customer Favourite";
      else if (rp.award === "Best Budget Pick") suggestedBadge = "Popular Pick";
      else if (rp.award === "Premium Choice") suggestedBadge = "Must Have";
      else if (rp.award === "Editor's Top Recommendation") suggestedBadge = "Editor's Choice";
      else if (rp.rating >= 4.6) suggestedBadge = "Customer Favourite";
      else if (rp.overallScore >= 85) suggestedBadge = "Trending Now";

      return {
        ...rp,
        suggestedCategories,
        suggestedThemes,
        suggestedSubcategories: Array.from(new Set(matchedSubcategories)),
        suggestedCategoryName,
        suggestedBadge,
      };
    });

    const finalResult = {
      ...analysisResult,
      rankedProducts: enrichedRankedProducts,
    };

    // Optionally persist in curation batch store
    if (saveBatch) {
      recommendationsStore.saveBatch(finalResult as any);
    }

    return NextResponse.json({
      success: true,
      ...finalResult,
    });
  } catch (error: any) {
    console.error("[AI Analyze Route Error]", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to analyze products with AI.",
      },
      { status: 500 }
    );
  }
}
