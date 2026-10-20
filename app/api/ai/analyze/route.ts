import { NextRequest, NextResponse } from "next/server";
import { analyzeCategoryProducts } from "@/lib/ai";
import { fetchCreatorProducts, NormalizedCreatorProduct, extractAsin } from "@/lib/amazon-creator";
import { recommendationsStore } from "@/lib/recommendations-store";

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
      provider,
      forceFresh,
    });

    // Optionally persist in curation batch store
    if (saveBatch) {
      recommendationsStore.saveBatch(analysisResult);
    }

    return NextResponse.json({
      success: true,
      ...analysisResult,
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
