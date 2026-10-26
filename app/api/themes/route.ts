import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/themes — returns all lifestyle themes with dynamic product counts
 */
export async function GET(_req: NextRequest) {
  try {
    const [themes, allProducts] = await Promise.all([
      db.getThemes(),
      db.getProducts({ limit: 2000 }),
    ]);

    // Calculate dynamic counts
    const themesWithCounts = themes.map((theme) => {
      const matchingCount = allProducts.filter((p) => p.themes.includes(theme.slug)).length;
      return {
        ...theme,
        productCount: matchingCount,
      };
    });

    return NextResponse.json({
      success: true,
      count: themesWithCounts.length,
      data: themesWithCounts,
      totalCatalogProducts: allProducts.length,
    });
  } catch (err: any) {
    console.error("[GET /api/themes]", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch themes" },
      { status: 500 }
    );
  }
}
