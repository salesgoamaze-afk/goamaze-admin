import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken, getTokenFromCookies } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SingleProductSchema = z.object({
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

const BatchSchema = z.object({
  products: z.array(SingleProductSchema).min(1, "At least one product is required for batch import"),
});

/**
 * GET /api/products/batch?checkAsins=B09B2SBHQK,B0D14BB5XY
 * Checks which ASINs already exist in the GoAmaze database.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkAsinsStr = searchParams.get("checkAsins");
    if (!checkAsinsStr) {
      return NextResponse.json({ success: true, existingAsins: [] });
    }

    const asins = checkAsinsStr.split(",").map((s) => s.trim()).filter(Boolean);
    const existing = await db.checkExistingAsins(asins);

    return NextResponse.json({ success: true, existingAsins: existing });
  } catch (err: any) {
    console.error("[GET /api/products/batch]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to check existing ASINs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products/batch
 * Imports multiple products into the GoAmaze database in one request.
 * Automatically prevents duplicates and updates existing records.
 */
export async function POST(req: NextRequest) {
  try {
    // Admin Authentication Check
    const token = await getTokenFromCookies(req);
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Unauthorized — please login to GoAmaze Admin" },
        { status: 401 }
      );
    }

    const rawBody = await req.json();
    const normalizedBody = Array.isArray(rawBody) ? { products: rawBody } : rawBody;

    const parsed = BatchSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const preparedProducts = parsed.data.products.map((item) => ({
      ...item,
      source: item.source || "amazon",
      originalPrice: item.originalPrice || item.price,
      subtitle: item.subtitle || `Authentic ${item.title.slice(0, 60)} — top-rated choice`,
      images: Array.isArray(item.images) && item.images.length > 0 ? item.images : [item.image],
      categories: item.categories || [],
      themes: item.themes || [],
      collections: item.collections || [],
    }));

    const result = await db.createProductsBatch(preparedProducts as any);

    const addedCount = result.added.length;
    const updatedCount = result.updated.length;

    let msg = `Successfully processed ${result.count} product${result.count === 1 ? "" : "s"}`;
    if (addedCount > 0 && updatedCount > 0) {
      msg += ` (${addedCount} newly added, ${updatedCount} updated, 0 duplicates created).`;
    } else if (addedCount > 0) {
      msg += ` (${addedCount} newly added, 0 duplicates created).`;
    } else {
      msg += ` (${updatedCount} updated with latest data, 0 duplicates created).`;
    }

    return NextResponse.json(
      {
        success: true,
        message: msg,
        count: result.count,
        addedCount,
        updatedCount,
        data: [...result.added, ...result.updated],
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/products/batch]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to batch import products" },
      { status: 500 }
    );
  }
}
