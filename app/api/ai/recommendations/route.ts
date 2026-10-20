import { NextRequest, NextResponse } from "next/server";
import { recommendationsStore } from "@/lib/recommendations-store";
import { fetchCreatorProducts } from "@/lib/amazon-creator";
import { analyzeCategoryProducts } from "@/lib/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/recommendations
 *
 * Query params:
 * - category: e.g. "Smart Kitchen"
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    if (category) {
      const batch = recommendationsStore.getBatch(category);
      if (!batch) {
        return NextResponse.json({
          success: true,
          found: false,
          category,
          message: `No saved AI recommendations found for "${category}". Please run analysis first.`,
        });
      }
      return NextResponse.json({
        success: true,
        found: true,
        batch,
      });
    }

    const allBatches = recommendationsStore.getAllBatches();
    return NextResponse.json({
      success: true,
      totalBatches: allBatches.length,
      batches: allBatches,
    });
  } catch (error: any) {
    console.error("[Recommendations GET Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load recommendations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/recommendations
 *
 * Actions supported:
 * 1. "approve_single": { "action": "approve_single", "product": {...} }
 * 2. "approve_batch": { "action": "approve_batch", "products": [...] }
 * 3. "reject_single": { "action": "reject_single", "category": "...", "asin": "..." }
 * 4. "reanalyze": { "action": "reanalyze", "category": "..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, product, products, category, asin, weights, provider } = body;

    switch (action) {
      case "approve_single": {
        if (!product || !product.asin) {
          return NextResponse.json(
            { success: false, error: "Invalid product object provided for approval." },
            { status: 400 }
          );
        }

        const saved = await recommendationsStore.approveAndPublishProduct(product);
        return NextResponse.json({
          success: true,
          action: "approve_single",
          product: saved,
          message: `Product "${product.title?.slice(0, 45)}…" approved and published to GoAmaze database!`,
        });
      }

      case "approve_batch": {
        if (!Array.isArray(products) || products.length === 0) {
          return NextResponse.json(
            { success: false, error: "No products provided for batch approval." },
            { status: 400 }
          );
        }

        const result = await recommendationsStore.approveAndPublishBatch(products);
        return NextResponse.json({
          success: true,
          action: "approve_batch",
          count: result.count,
          ids: result.ids,
          message: `Successfully approved and published ${result.count} product${result.count === 1 ? "" : "s"} to GoAmaze database!`,
        });
      }

      case "reject_single": {
        if (!category || !asin) {
          return NextResponse.json(
            { success: false, error: "Category and ASIN are required to reject a product." },
            { status: 400 }
          );
        }

        const updated = recommendationsStore.updateProductStatus(category, asin, "rejected");
        return NextResponse.json({
          success: true,
          action: "reject_single",
          product: updated,
          message: `Product ${asin} marked as rejected.`,
        });
      }

      case "reanalyze": {
        if (!category) {
          return NextResponse.json(
            { success: false, error: "Category is required for re-analysis." },
            { status: 400 }
          );
        }

        const existingBatch = recommendationsStore.getBatch(category);
        if (!existingBatch || existingBatch.rankedProducts.length === 0) {
          return NextResponse.json(
            { success: false, error: `No previous recommendation batch found for "${category}" to re-analyze.` },
            { status: 404 }
          );
        }

        // Extract ASINs and fetch fresh live attributes from Amazon Creators API
        const asins = existingBatch.rankedProducts.map((p) => p.asin);
        const liveProductsMap = await fetchCreatorProducts(asins);
        const freshProducts = Object.values(liveProductsMap);

        if (freshProducts.length === 0) {
          return NextResponse.json(
            { success: false, error: "Could not fetch updated product details from Amazon Creators API." },
            { status: 502 }
          );
        }

        // Re-analyze with AI
        const newBatch = await analyzeCategoryProducts(category, freshProducts, {
          weights: weights || existingBatch.weightsUsed,
          provider,
          forceFresh: true,
        });

        recommendationsStore.saveBatch(newBatch);

        return NextResponse.json({
          success: true,
          action: "reanalyze",
          batch: newBatch,
          message: `Re-analysis complete! Updated prices, ratings, and rankings for ${freshProducts.length} products.`,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unsupported action: "${action}"` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[Recommendations POST Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process recommendation action." },
      { status: 500 }
    );
  }
}
