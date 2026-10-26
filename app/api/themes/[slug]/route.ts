import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * GET /api/themes/:slug — returns theme definition & its associated canonical products
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const theme = await db.getThemeBySlug(slug);

    if (!theme) {
      return NextResponse.json(
        { success: false, message: `Theme "${slug}" not found` },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const sort = (searchParams.get("sort") as any) || undefined;
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    const products = await db.getProducts({
      theme: theme.slug,
      search,
      sort,
      limit,
      page,
    });

    return NextResponse.json({
      success: true,
      theme,
      count: products.length,
      products,
    });
  } catch (err: any) {
    console.error("[GET /api/themes/:slug]", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
