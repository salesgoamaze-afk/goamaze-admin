import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ProductSchema = z.object({
  id:            z.string().optional(),
  title:         z.string().min(1).max(600),
  subtitle:      z.string().optional().default("Top-rated essentials recommended on GoAmaze"),
  description:   z.string().optional().default(""),
  price:         z.string().min(1),
  originalPrice: z.string().optional().default(""),
  unitPrice:     z.string().optional().default(""),
  category:      z.string().optional(),
  categories:    z.array(z.string()).optional().default([]),
  themes:        z.array(z.string()).optional().default([]),
  collections:   z.array(z.string()).optional().default([]),
  image:         z.string().min(1),
  images:        z.array(z.string()).optional().default([]),
  instagramUrl:  z.string().optional().default(""),
  affiliateLink: z.string().min(1),
  badge:         z.string().optional().default("New"),
  rating:        z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === null || v === undefined || v === "") return 4.5;
    const n = Number(v);
    return isNaN(n) ? 4.5 : Math.max(0, Math.min(5, n));
  }),
  reviews:       z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = parseInt(String(v), 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }),
  featured:      z.boolean().optional().default(false),
  source:        z.string().optional().default("amazon"),
  analysisStatus: z.string().optional(),
});

/**
 * GET /api/products — public storefront & admin query endpoint
 * 
 * Query params supported:
 * - theme: e.g. "smart-living", "work-study-gaming", "kitchen-everyday-essentials"
 * - category: e.g. "mobiles", "electronics", "kitchen-appliances"
 * - collection: e.g. "festival-special-diwali"
 * - search: free text search query
 * - status: analysis status ("ANALYZED", "NEEDS_REVIEW", "PENDING_ANALYSIS", "FAILED")
 * - featured: true | false
 * - sort: "featured" | "rating" | "price-asc" | "price-desc" | "newest"
 * - limit: max items to return (default 100)
 * - page: page number
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const theme      = searchParams.get("theme") || undefined;
    const category   = searchParams.get("category") || undefined;
    const collection = searchParams.get("collection") || undefined;
    const search     = searchParams.get("search") || undefined;
    const status     = searchParams.get("status") || undefined;
    const sort       = (searchParams.get("sort") as any) || undefined;
    const featured   = searchParams.get("featured") ? searchParams.get("featured") === "true" : undefined;
    const limit      = parseInt(searchParams.get("limit") || "100", 10);
    const page       = parseInt(searchParams.get("page") || "1", 10);

    const products = await db.getProducts({
      theme,
      category,
      collection,
      search,
      status,
      sort,
      featured,
      limit,
      page,
    });

    return NextResponse.json({
      success: true,
      count: products.length,
      data: products,
      filters: { theme, category, collection, search, status },
    });
  } catch (err: any) {
    console.error("[GET /api/products]", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/** POST /api/products — admin only (auto deduplicates / updates existing) */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const token   = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const parsed = ProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const dataToCreate = {
      ...parsed.data,
      source: parsed.data.source || "amazon",
      originalPrice: parsed.data.originalPrice || parsed.data.price,
      subtitle: parsed.data.subtitle || `Authentic ${parsed.data.title.slice(0, 60)} — top-rated choice`,
      category: parsed.data.category || (parsed.data.categories && parsed.data.categories[0]) || "home-kitchen",
    };

    const product = await db.upsertProduct(dataToCreate as any, { sourceRule: "manual" });
    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/products]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
